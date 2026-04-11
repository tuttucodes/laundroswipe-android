import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { isWithinVendorBillCancelEditWindow } from '@/lib/vendor-bill-policy';
import { orderLookupTokenVariants, stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';

type LookupResponse =
  | {
      ok: true;
      order: Record<string, unknown>;
      user: Record<string, unknown> | null;
      existing_bills_count: number;
      latest_bill: {
        id: string;
        created_at: string;
        can_cancel: boolean;
        total_items: number;
        subtotal: number;
        total: number;
        line_items: Array<{
          id: string;
          label: string;
          price: number;
          qty: number;
          image_url?: string | null;
        }>;
      } | null;
    }
  | { ok: false; error: string };

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

const ORDER_SELECT = `
  id,
  order_number,
  token,
  service_id,
  service_name,
  pickup_date,
  time_slot,
  status,
  instructions,
  user_id,
  created_at,
  delivery_confirmed_at,
  delivery_comments,
  vendor_name,
  vendor_id,
  users (
    id,
    full_name,
    email,
    phone,
    whatsapp,
    user_type,
    college_id,
    reg_no,
    hostel_block,
    room_number,
    year,
    display_id
  )
`.replace(/\s+/g, ' ');

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

  const tokenVariants = orderLookupTokenVariants(token);
  const billTokenKey = stripLeadingHashesFromToken(token);

  const [ordersRes, billCountRes, latestBillRes] = await Promise.all([
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .in('token', tokenVariants)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('vendor_bills')
      .select('*', { count: 'exact', head: true })
      .ilike('order_token', billTokenKey)
      .is('cancelled_at', null),
    supabase
      .from('vendor_bills')
      .select('id, created_at, line_items, subtotal, total')
      .ilike('order_token', billTokenKey)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let orderRowRes = ordersRes;
  if (orderRowRes.error) {
    orderRowRes = await supabase
      .from('orders')
      .select(
        'id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, created_at, delivery_confirmed_at, delivery_comments, vendor_name, vendor_id',
      )
      .in('token', tokenVariants)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  }
  if (orderRowRes.error) return NextResponse.json({ error: orderRowRes.error.message }, { status: 500 });
  const row = orderRowRes.data as Record<string, unknown> | null;
  if (!row) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

  let userRow: Record<string, unknown> | null = null;
  let order: Record<string, unknown>;
  if ('users' in row && row.users != null) {
    const embedded = row.users;
    if (embedded && typeof embedded === 'object' && !Array.isArray(embedded)) {
      userRow = embedded as Record<string, unknown>;
    } else if (Array.isArray(embedded) && embedded[0] && typeof embedded[0] === 'object') {
      userRow = embedded[0] as Record<string, unknown>;
    }
    const { users: _drop, ...rest } = row;
    order = rest;
  } else {
    order = row;
    const uid = row.user_id;
    if (uid) {
      const { data: u, error: uErr } = await supabase
        .from('users')
        .select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id')
        .eq('id', String(uid))
        .maybeSingle();
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
      userRow = (u as Record<string, unknown> | null) ?? null;
    }
  }

  const vendorSlug = resolveVendorSlugFromSession(session);
  if (vendorSlug) {
    const orderVendorSlug = resolveVendorSlugFromOrderVendorName(order.vendor_name as string | null | undefined);
    if (orderVendorSlug && orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ ok: false, error: 'Forbidden for this vendor' }, { status: 403 });
    }
  }

  let countRes = billCountRes;
  let latestRes = latestBillRes;
  if (countRes.error?.code === '42703' || latestRes.error?.code === '42703') {
    const [c2, l2] = await Promise.all([
      supabase
        .from('vendor_bills')
        .select('*', { count: 'exact', head: true })
        .ilike('order_token', billTokenKey),
      supabase
        .from('vendor_bills')
        .select('id, created_at, line_items, subtotal, total')
        .ilike('order_token', billTokenKey)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    countRes = c2;
    latestRes = l2;
  }

  if (countRes.error) return NextResponse.json({ error: countRes.error.message }, { status: 500 });
  if (latestRes.error) return NextResponse.json({ error: latestRes.error.message }, { status: 500 });

  const latestBill = latestRes.data;
  const latestBillCanCancel =
    !!latestBill && isWithinVendorBillCancelEditWindow(String(latestBill.created_at));

  return NextResponse.json({
    ok: true,
    order,
    user: userRow,
    existing_bills_count: countRes.count ?? 0,
    latest_bill: latestBill
      ? {
          id: String(latestBill.id),
          created_at: String(latestBill.created_at),
          can_cancel: latestBillCanCancel,
          total_items: Array.isArray(latestBill.line_items)
            ? (latestBill.line_items as Array<{ qty?: number }>).reduce((s, i) => s + (Number(i.qty) || 0), 0)
            : 0,
          subtotal: Number(latestBill.subtotal) || 0,
          total: Number(latestBill.total) || 0,
          line_items: Array.isArray(latestBill.line_items) ? latestBill.line_items : [],
        }
      : null,
  } satisfies LookupResponse);
}
