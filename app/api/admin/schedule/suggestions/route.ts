import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

type DbVendor = { id: string; slug: string; name: string };

function resolveVendorSlugFromName(vendorName: string | null | undefined, dbVendors: DbVendor[]): string | null {
  const n = (vendorName ?? '').toLowerCase().trim();
  if (!n) return null;
  for (const v of dbVendors) {
    const vn = v.name.toLowerCase();
    if (n.includes(vn) || vn.includes(n)) return v.slug;
  }
  const match = VENDORS.find((x) => n.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(n));
  return match?.id ?? null;
}

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'super_admin' && session.role !== 'vendor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { data: vendorsData, error: vErr } = await supabase.from('vendors').select('id, slug, name').order('name', { ascending: true });
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  const dbVendors = (vendorsData ?? []) as DbVendor[];
  const vendorsById = new Map<string, string>(dbVendors.map((v) => [v.id, v.slug]));

  const { data: ordersData, error: oErr } = await supabase
    .from('orders')
    .select('pickup_date, time_slot, vendor_id, vendor_name');
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  const vendorSlugFilter = session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  const rows = (ordersData ?? []).filter((o: { vendor_id?: string | null; vendor_name?: string | null }) => {
    if (!vendorSlugFilter) return true;
    const byId = o.vendor_id ? vendorsById.get(String(o.vendor_id)) : null;
    const byName = resolveVendorSlugFromName(o.vendor_name, dbVendors);
    const slug = (byId ?? byName ?? '') as string;
    return String(slug).toLowerCase() === vendorSlugFilter;
  });

  const slotMap = new Map<string, number>();
  const dowMap = new Map<number, number>();

  for (const o of rows) {
    const ts = String((o as { time_slot?: string | null }).time_slot ?? '').trim();
    if (ts) slotMap.set(ts, (slotMap.get(ts) ?? 0) + 1);

    const pd = String((o as { pickup_date?: string | null }).pickup_date ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(pd)) {
      const d = new Date(`${pd}T12:00:00Z`);
      const dow = d.getUTCDay();
      dowMap.set(dow, (dowMap.get(dow) ?? 0) + 1);
    }
  }

  const slot_counts = Array.from(slotMap.entries())
    .map(([time_slot, count]) => ({ time_slot, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const dow_counts = Array.from(dowMap.entries())
    .map(([dow, count]) => ({ dow, label: DOW_LABELS[dow] ?? `Day ${dow}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  return NextResponse.json({ ok: true, slot_counts, dow_counts });
}
