import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const vendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  let vendorDbId: string | null = null;
  if (vendorSlug) {
    const vendorRes = await supabase.from('vendors').select('id').eq('slug', vendorSlug).single();
    if (vendorRes.error || !vendorRes.data) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }
    vendorDbId = vendorRes.data.id;
  }

  const now = new Date();
  const msDay = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(now.getTime() - 7 * msDay).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * msDay).toISOString();

  // Try RPC for revenue first (handles dedup + vendor filter server-side)
  const [rpc7d, rpc30d] = await Promise.all([
    supabase.rpc('get_revenue_by_date', {
      p_group_days: 1,
      p_vendor_id: vendorDbId,
      p_from: sevenDaysAgo,
      p_to: now.toISOString(),
    }),
    supabase.rpc('get_revenue_by_date', {
      p_group_days: 1,
      p_vendor_id: vendorDbId,
      p_from: thirtyDaysAgo,
      p_to: now.toISOString(),
    }),
  ]);

  // Build open tokens query (orders not yet delivered)
  let openQuery = supabase
    .from('orders')
    .select('id, status')
    .not('status', 'eq', 'delivered');

  if (vendorDbId) {
    openQuery = openQuery.eq('vendor_id', vendorDbId);
  } else if (vendorSlug) {
    const v = VENDORS.find((x) => x.id === vendorSlug);
    if (v) openQuery = (openQuery as any).ilike('vendor_name', `%${v.name}%`);
  }

  // Build delivered 7d query
  let deliveredQuery = supabase
    .from('orders')
    .select('id, delivery_confirmed_at, token')
    .eq('status', 'delivered')
    .gte('delivery_confirmed_at', sevenDaysAgo);

  if (vendorDbId) {
    deliveredQuery = deliveredQuery.eq('vendor_id', vendorDbId);
  } else if (vendorSlug) {
    const v = VENDORS.find((x) => x.id === vendorSlug);
    if (v) deliveredQuery = (deliveredQuery as any).ilike('vendor_name', `%${v.name}%`);
  }

  const [openRes, deliveredRes] = await Promise.all([openQuery, deliveredQuery]);

  if (openRes.error) return NextResponse.json({ error: openRes.error.message }, { status: 500 });
  if (deliveredRes.error) return NextResponse.json({ error: deliveredRes.error.message }, { status: 500 });

  // Process revenue data
  const toRevenueBuckets = (rpcData: any[]) =>
    (rpcData ?? []).map((r: any) => ({
      date: String(r.date_from),
      bill_count: Number(r.bill_count),
      total: Math.round(Number(r.total_sum) * 100) / 100,
    }));

  const rev7dBuckets = !rpc7d.error ? toRevenueBuckets(rpc7d.data ?? []) : [];
  const rev30dBuckets = !rpc30d.error ? toRevenueBuckets(rpc30d.data ?? []) : [];

  const sumBuckets = (buckets: { total: number; bill_count: number }[]) => ({
    total: Math.round(buckets.reduce((s, b) => s + b.total, 0) * 100) / 100,
    bill_count: buckets.reduce((s, b) => s + b.bill_count, 0),
  });

  // Process open tokens by status
  const byStatus: Record<string, number> = {};
  for (const o of openRes.data ?? []) {
    const s = String(o.status);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  // Process delivered 7d by date
  const deliveredByDate = new Map<string, number>();
  for (const o of deliveredRes.data ?? []) {
    const d = o.delivery_confirmed_at
      ? new Date(o.delivery_confirmed_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    deliveredByDate.set(d, (deliveredByDate.get(d) ?? 0) + 1);
  }

  return NextResponse.json({
    ok: true,
    revenue_7d: {
      ...sumBuckets(rev7dBuckets),
      by_date: rev7dBuckets.sort((a, b) => a.date.localeCompare(b.date)),
    },
    revenue_30d: {
      ...sumBuckets(rev30dBuckets),
      by_date: rev30dBuckets.sort((a, b) => a.date.localeCompare(b.date)),
    },
    open_tokens: {
      count: openRes.data?.length ?? 0,
      by_status: byStatus,
    },
    delivered_7d: {
      count: deliveredRes.data?.length ?? 0,
      by_date: Array.from(deliveredByDate.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    },
  });
}
