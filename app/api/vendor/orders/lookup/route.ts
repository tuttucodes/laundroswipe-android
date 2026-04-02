import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

type LookupResponse = {
  ok: true;
  order: any;
  user: any | null;
  existing_bills_count: number;
  latest_bill: {
    id: string;
    created_at: string;
    cancelled_at: string | null;
    can_cancel: boolean;
  } | null;
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

  let latestBill: { id: string; created_at: string; cancelled_at?: string | null } | null = null;
  let latestBillErr: { message: string; code?: string } | null = null;
  const withCancelCols = await supabase
    .from('vendor_bills')
    .select('id, created_at, cancelled_at')
    .eq('order_token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  latestBill = (withCancelCols.data as { id: string; created_at: string; cancelled_at?: string | null } | null) ?? null;
  latestBillErr = withCancelCols.error as { message: string; code?: string } | null;
  if (latestBillErr?.code === '42703') {
    const fallback = await supabase
      .from('vendor_bills')
      .select('id, created_at')
      .eq('order_token', token)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    latestBill = (fallback.data as { id: string; created_at: string } | null) ?? null;
    latestBillErr = fallback.error as { message: string; code?: string } | null;
  }
  if (latestBillErr) return NextResponse.json({ error: latestBillErr.message }, { status: 500 });
  const latestBillCreatedAtMs = latestBill?.created_at ? new Date(String(latestBill.created_at)).getTime() : NaN;
  const latestBillCanCancel =
    !!latestBill &&
    !latestBill.cancelled_at &&
    Number.isFinite(latestBillCreatedAtMs) &&
    Date.now() - latestBillCreatedAtMs <= 60 * 60 * 1000;

  return NextResponse.json({
    ok: true,
    order,
    user: userRow ?? null,
    existing_bills_count: count ?? 0,
    latest_bill: latestBill
      ? {
          id: String(latestBill.id),
          created_at: String(latestBill.created_at),
          cancelled_at: latestBill.cancelled_at ? String(latestBill.cancelled_at) : null,
          can_cancel: latestBillCanCancel,
        }
      : null,
  } satisfies LookupResponse);
}

