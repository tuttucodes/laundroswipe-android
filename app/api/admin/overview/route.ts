import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

type OrderWithVendorSlug = {
  vendor_slug: string | null;
  [key: string]: unknown;
};

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

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const [vendorsRes, ordersRes, usersRes, billsRes] = await Promise.all([
    supabase.from('vendors').select('id, slug, name, active').order('name', { ascending: true }),
    supabase
      .from('orders')
      .select(
        'id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, created_at, delivery_confirmed_at, delivery_comments, vendor_id, vendor_name'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, year, display_id')
      .order('created_at', { ascending: false }),
    supabase
      .from('vendor_bills')
      .select('id, order_id, order_token, order_number, customer_name, customer_phone, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (vendorsRes.error) return NextResponse.json({ error: vendorsRes.error.message }, { status: 500 });
  if (ordersRes.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 500 });
  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
  if (billsRes.error) return NextResponse.json({ error: billsRes.error.message }, { status: 500 });

  const dbVendors = (vendorsRes.data ?? []) as DbVendor[];
  const vendorsById = new Map<string, string>(dbVendors.map((v) => [v.id, v.slug]));

  const vendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  const orders = (ordersRes.data ?? [])
    .map((o: any) => {
      const byId = o.vendor_id ? vendorsById.get(String(o.vendor_id)) : null;
      const byName = resolveVendorSlugFromName(o.vendor_name, dbVendors);
      return { ...o, vendor_slug: (byId ?? byName ?? null) as string | null } as OrderWithVendorSlug;
    })
    .filter((o: OrderWithVendorSlug) => {
      if (!vendorSlug) return true;
      return String(o.vendor_slug ?? '').toLowerCase() === vendorSlug;
    });

  const orderIds = new Set(orders.map((o: any) => o.id as string));

  const bills = (billsRes.data ?? []).filter((b: any) => {
    if (!vendorSlug) return true;
    const byVendorId = b.vendor_id ? vendorsById.get(String(b.vendor_id)) : null;
    const byVendorName = resolveVendorSlugFromName(b.vendor_name, dbVendors);
    const billVendorSlug = (byVendorId ?? byVendorName ?? null) as string | null;
    return (
      String(billVendorSlug ?? '').toLowerCase() === vendorSlug &&
      (!b.order_id || orderIds.has(String(b.order_id)))
    );
  });

  const billsWithVendorSlug = bills.map((b: any) => {
    const byVendorId = b.vendor_id ? vendorsById.get(String(b.vendor_id)) : null;
    const byVendorName = resolveVendorSlugFromName(b.vendor_name, dbVendors);
    return { ...b, vendor_slug: (byVendorId ?? byVendorName ?? null) as string | null };
  });

  const vendorsPayload =
    session.role === 'super_admin'
      ? dbVendors
      : vendorSlug
        ? dbVendors.filter((v) => v.slug === vendorSlug)
        : [];

  return NextResponse.json({
    ok: true,
    orders,
    users: usersRes.data ?? [],
    vendor_bills: billsWithVendorSlug,
    vendors: vendorsPayload,
  });
}
