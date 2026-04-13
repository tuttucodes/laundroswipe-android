import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';

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

  const url = new URL(request.url);
  const ordersPage = Math.max(1, Number(url.searchParams.get('orders_page') || '1'));
  const ordersLimit = Math.min(200, Math.max(1, Number(url.searchParams.get('orders_limit') || '100')));
  const billsPage = Math.max(1, Number(url.searchParams.get('bills_page') || '1'));
  const billsLimit = Math.min(200, Math.max(1, Number(url.searchParams.get('bills_limit') || '50')));

  const vendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  const vendorsRes = await supabase.from('vendors').select('id, slug, name, active').order('name', { ascending: true });
  if (vendorsRes.error) return NextResponse.json({ error: vendorsRes.error.message }, { status: 500 });
  const dbVendors = (vendorsRes.data ?? []) as DbVendor[];
  const vendorsById = new Map<string, string>(dbVendors.map((v) => [v.id, v.slug]));
  const vendorDbId = vendorSlug
    ? dbVendors.find((v) => v.slug === vendorSlug)?.id ?? null
    : null;

  // Build paginated queries
  const buildOrdersQuery = () => {
    let q = supabase
      .from('orders')
      .select(
        'id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, created_at, delivery_confirmed_at, delivery_comments, vendor_id, vendor_name',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });
    if (vendorDbId) q = q.eq('vendor_id', vendorDbId);
    q = q.range((ordersPage - 1) * ordersLimit, ordersPage * ordersLimit - 1);
    return q;
  };

  const buildBillsQuery = () => {
    let q = supabase
      .from('vendor_bills')
      .select(
        'id, order_id, order_token, order_number, customer_name, customer_phone, user_id, subtotal, convenience_fee, total, vendor_name, vendor_id, created_at, cancelled_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });
    if (vendorDbId) q = q.eq('vendor_id', vendorDbId);
    if (session.role === 'vendor') q = q.is('cancelled_at', null);
    q = q.range((billsPage - 1) * billsLimit, billsPage * billsLimit - 1);
    return q;
  };

  const [ordersRes, usersRes, billsRes] = await Promise.all([
    buildOrdersQuery(),
    supabase
      .from('users')
      .select('id, full_name, email, phone, user_type, reg_no, hostel_block, room_number, display_id')
      .order('created_at', { ascending: false })
      .limit(200),
    buildBillsQuery(),
  ]);

  if (ordersRes.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 500 });
  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
  if (billsRes.error) return NextResponse.json({ error: billsRes.error.message }, { status: 500 });

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

  const billsFiltered = (billsRes.data ?? [])
    .filter((b: any) => {
      if (!vendorSlug) return true;
      const byVendorId = b.vendor_id ? vendorsById.get(String(b.vendor_id)) : null;
      const byVendorName = resolveVendorSlugFromName(b.vendor_name, dbVendors);
      const billVendorSlug = (byVendorId ?? byVendorName ?? null) as string | null;
      return String(billVendorSlug ?? '').toLowerCase() === vendorSlug;
    })
    .map((b: any) => {
      const byVendorId = b.vendor_id ? vendorsById.get(String(b.vendor_id)) : null;
      const byVendorName = resolveVendorSlugFromName(b.vendor_name, dbVendors);
      return { ...b, vendor_slug: (byVendorId ?? byVendorName ?? null) as string | null };
    });

  const seenTokens = new Set<string>();
  const bills: any[] = [];
  for (const b of billsFiltered) {
    const tokenKey = stripLeadingHashesFromToken(String(b.order_token ?? '')).toLowerCase();
    if (!tokenKey) {
      bills.push(b);
      continue;
    }
    if (seenTokens.has(tokenKey)) continue;
    seenTokens.add(tokenKey);
    bills.push(b);
  }

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
    vendor_bills: bills,
    vendors: vendorsPayload,
    pagination: {
      orders: { page: ordersPage, limit: ordersLimit, total: (ordersRes as any).count ?? 0 },
      bills: { page: billsPage, limit: billsLimit, total: (billsRes as any).count ?? 0 },
    },
  });
}
