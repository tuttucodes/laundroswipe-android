import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

type DbVendor = { id: string; slug: string; name: string };

function resolveVendorSlugFromName(vendorName: string | null | undefined, dbVendors: DbVendor[]): string | null {
  const v = (vendorName ?? '').toLowerCase().trim();
  if (!v) return null;
  const dbMatch = dbVendors.find((x) => v.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(v));
  if (dbMatch) return dbMatch.slug;
  const match = VENDORS.find((x) => v.includes(x.name.toLowerCase()) || v === x.name.toLowerCase());
  return match?.id ?? null;
}

type BucketData = { date_from: string; date_to: string; bill_count: number; subtotal: number; convenience_fee: number; total: number };

function buildResponse(groupByDays: number, revenue: BucketData[]) {
  const grandTotal = revenue.reduce((s, r) => s + r.total, 0);
  const grandSubtotal = revenue.reduce((s, r) => s + r.subtotal, 0);
  const grandFees = revenue.reduce((s, r) => s + r.convenience_fee, 0);
  const totalBills = revenue.reduce((s, r) => s + r.bill_count, 0);
  return NextResponse.json({
    ok: true,
    group_by_days: groupByDays,
    total_bills: totalBills,
    grand_subtotal: Math.round(grandSubtotal * 100) / 100,
    grand_convenience_fee: Math.round(grandFees * 100) / 100,
    grand_total: Math.round(grandTotal * 100) / 100,
    revenue: revenue.map((r) => ({
      ...r,
      subtotal: Math.round(r.subtotal * 100) / 100,
      convenience_fee: Math.round(r.convenience_fee * 100) / 100,
      total: Math.round(r.total * 100) / 100,
    })),
  });
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(request.url);
  const groupByDays = Math.max(1, Math.min(30, Number(url.searchParams.get('days') || '1')));
  const fromDate = url.searchParams.get('from') || null;
  const toDate = url.searchParams.get('to') || null;

  const vendorSlug = session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? '' : '';

  const { data: vendorsData } = await supabase.from('vendors').select('id, slug, name');
  const dbVendors = (vendorsData ?? []) as DbVendor[];
  const vendorsById = new Map<string, string>(dbVendors.map((v) => [String(v.id), v.slug]));

  // Resolve vendor DB id for server-side filtering
  const vendorDbId = vendorSlug
    ? dbVendors.find((v) => v.slug === vendorSlug)?.id ?? null
    : null;

  // Try server-side RPC first (much faster for large datasets)
  const rpcResult = await supabase.rpc('get_revenue_by_date', {
    p_group_days: groupByDays,
    p_vendor_id: vendorDbId,
    p_from: fromDate ? `${fromDate}T00:00:00.000Z` : null,
    p_to: toDate ? `${toDate}T23:59:59.999Z` : null,
  });

  if (!rpcResult.error && Array.isArray(rpcResult.data)) {
    const revenue: BucketData[] = (rpcResult.data as any[]).map((r) => ({
      date_from: String(r.date_from),
      date_to: String(r.date_to),
      bill_count: Number(r.bill_count),
      subtotal: Number(r.subtotal_sum),
      convenience_fee: Number(r.convenience_fee_sum),
      total: Number(r.total_sum),
    }));
    return buildResponse(groupByDays, revenue);
  }

  // Fallback: JS-side aggregation (works before migration is run)
  let bills: any[] | null = null;
  {
    let query = supabase
      .from('vendor_bills')
      .select('subtotal, convenience_fee, total, vendor_id, vendor_name, created_at, cancelled_at')
      .is('cancelled_at', null)
      .order('created_at', { ascending: true });
    if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00.000Z`);
    if (toDate) query = query.lte('created_at', `${toDate}T23:59:59.999Z`);
    const res1 = await query;
    if (res1.error && res1.error.code === '42703') {
      let q2 = supabase
        .from('vendor_bills')
        .select('subtotal, convenience_fee, total, vendor_id, vendor_name, created_at')
        .order('created_at', { ascending: true });
      if (fromDate) q2 = q2.gte('created_at', `${fromDate}T00:00:00.000Z`);
      if (toDate) q2 = q2.lte('created_at', `${toDate}T23:59:59.999Z`);
      const res2 = await q2;
      if (res2.error) return NextResponse.json({ error: res2.error.message }, { status: 500 });
      bills = res2.data;
    } else if (res1.error) {
      return NextResponse.json({ error: res1.error.message }, { status: 500 });
    } else {
      bills = res1.data;
    }
  }

  const vendorFiltered = (bills ?? []).filter((b: any) => {
    if (!vendorSlug) return true;
    const byVendorId = b.vendor_id ? vendorsById.get(String(b.vendor_id)) : null;
    const byVendorName = resolveVendorSlugFromName(b.vendor_name, dbVendors);
    const billVendorSlug = (byVendorId ?? byVendorName ?? null) as string | null;
    return String(billVendorSlug ?? '').toLowerCase() === vendorSlug;
  });

  // Deduplicate: only remove exact duplicates (same token + same total amount)
  const seenBills = new Set<string>();
  const filtered: any[] = [];
  for (const b of vendorFiltered) {
    const dedupKey = `${b.order_token}|${Number(b.total ?? 0).toFixed(2)}`;
    if (seenBills.has(dedupKey)) continue;
    seenBills.add(dedupKey);
    filtered.push(b);
  }

  const buckets = new Map<string, BucketData>();
  for (const bill of filtered) {
    const d = new Date(bill.created_at as string);
    const daysSinceEpoch = Math.floor(d.getTime() / 86400000);
    const bucketStart = daysSinceEpoch - (daysSinceEpoch % groupByDays);
    const bucketStartDate = new Date(bucketStart * 86400000);
    const bucketEndDate = new Date((bucketStart + groupByDays - 1) * 86400000);
    const key = bucketStartDate.toISOString().slice(0, 10);
    const existing = buckets.get(key);
    const sub = Number(bill.subtotal ?? 0);
    const fee = Number(bill.convenience_fee ?? 0);
    const tot = Number(bill.total ?? 0);
    if (existing) {
      existing.bill_count += 1;
      existing.subtotal += sub;
      existing.convenience_fee += fee;
      existing.total += tot;
    } else {
      buckets.set(key, {
        date_from: bucketStartDate.toISOString().slice(0, 10),
        date_to: bucketEndDate.toISOString().slice(0, 10),
        bill_count: 1,
        subtotal: sub,
        convenience_fee: fee,
        total: tot,
      });
    }
  }

  const revenue = Array.from(buckets.values()).sort((a, b) => a.date_from.localeCompare(b.date_from));
  return buildResponse(groupByDays, revenue);
}
