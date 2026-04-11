import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { isWithinVendorBillCancelEditWindow } from '@/lib/vendor-bill-policy';

type LookupResponse = {
  ok: true;
  order: any;
  user: any | null;
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

  // === All queries in parallel ===
  const [ordersRes, billCountRes, latestBillRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, created_at, delivery_confirmed_at, delivery_comments, vendor_name, vendor_id')
      .eq('token', token)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('vendor_bills')
      .select('*', { count: 'exact', head: true })
      .eq('order_token', token)
      .is('cancelled_at', null),
    supabase
      .from('vendor_bills')
      .select('id, created_at, line_items, subtotal, total')
      .eq('order_token', token)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (ordersRes.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 500 });
  const order = Array.isArray(ordersRes.data) ? ordersRes.data[0] : null;
  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

  // Fetch user in parallel only if order has user_id (most will)
  const userPromise = order.user_id
    ? supabase.from('users').select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id').eq('id', order.user_id).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const vendorSlug = resolveVendorSlugFromSession(session);
  if (vendorSlug) {
    const orderVendorSlug = resolveVendorSlugFromOrderVendorName(order.vendor_name);
    if (orderVendorSlug && orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ ok: false, error: 'Forbidden for this vendor' }, { status: 403 });
    }
  }

  if (billCountRes.error) return NextResponse.json({ error: billCountRes.error.message }, { status: 500 });
  if (latestBillRes.error) return NextResponse.json({ error: latestBillRes.error.message }, { status: 500 });

  const { data: userRow, error: userErr } = await userPromise;
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  const latestBill = latestBillRes.data;
  const latestBillCanCancel =
    !!latestBill && isWithinVendorBillCancelEditWindow(String(latestBill.created_at));

  return NextResponse.json({
    ok: true,
    order,
    user: userRow ?? null,
    existing_bills_count: billCountRes.count ?? 0,
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
