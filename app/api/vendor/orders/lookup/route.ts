import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

type LookupResponse = {
  ok: true;
  order: any;
  user: any | null;
  existing_bills_count: number;
} | { ok: false; error: string };

function normalizeToken(token: string): string {
  return String(token).replace(/^#/, '').trim();
}

function resolveVendorSlugFromSession(session: ReturnType<typeof getAdminSessionFromRequest>): string | null {
  if (!session || session.role !== 'vendor') return null;
  return session.vendorId ? session.vendorId.toLowerCase().trim() : null;
}

function resolveVendorSlugFromOrderVendorName(orderVendorName: string | null | undefined): string | null {
  const v = (orderVendorName ?? '').toLowerCase();
  if (!v) return null;
  const match = VENDORS.find((x) => v.includes(x.name.toLowerCase()) || v === x.name.toLowerCase());
  return match?.id ?? null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const token = normalizeToken(body.token ?? '');
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, created_at, delivery_confirmed_at, delivery_comments, vendor_name, vendor_id')
    .eq('token', token)
    .order('created_at', { ascending: false })
    .limit(1);

  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });
  const order = Array.isArray(orders) ? orders[0] : null;
  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

  const { data: userRow, error: userErr } = order.user_id
    ? await supabase.from('users').select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, year, display_id').eq('id', order.user_id).maybeSingle()
    : { data: null, error: null };

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  const vendorSlug = resolveVendorSlugFromSession(session);
  if (vendorSlug) {
    // Enforce only that the order is assigned to this vendor.
    const orderVendorSlug = resolveVendorSlugFromOrderVendorName(order.vendor_name);
    if (orderVendorSlug && orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ ok: false, error: 'Forbidden for this vendor' }, { status: 403 });
    }
  }

  const { count, error: countErr } = await supabase
    .from('vendor_bills')
    .select('*', { count: 'exact', head: true })
    .eq('order_token', token);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    order,
    user: userRow ?? null,
    existing_bills_count: count ?? 0,
  } satisfies LookupResponse);
}

