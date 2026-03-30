import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS, VENDOR_BILL_ITEMS } from '@/lib/constants';

function normalizeToken(token: string): string {
  return String(token).replace(/^#/, '').trim();
}

function priceForItemId(itemId: string): number | null {
  const item = (VENDOR_BILL_ITEMS as any).find((i: any) => i.id === itemId);
  return item ? Number(item.price) : null;
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: {
    token?: string;
    line_items?: Array<{ id: string; qty: number }>;
    order_number?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const token = normalizeToken(body.token ?? '');
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
  if (lineItems.length === 0) return NextResponse.json({ error: 'line_items is required' }, { status: 400 });

  // Load order so we can trust customer info + vendor_id.
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, token, user_id, vendor_id, vendor_name')
    .eq('token', token)
    .limit(1);
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });
  const order = Array.isArray(orders) ? orders[0] : null;
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (session.role === 'vendor') {
    const vendorSlug = session.vendorId?.toLowerCase().trim() ?? '';
    const orderVendorSlug = VENDORS.find((v) => v.name.toLowerCase() === String(order.vendor_name ?? '').toLowerCase())?.id ?? null;
    if (orderVendorSlug && orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const safeLineItems: Array<{ id: string; label: string; qty: number; price: number }> = [];
  for (const li of lineItems) {
    const id = String(li?.id ?? '').trim();
    const qty = Number(li?.qty ?? 0);
    if (!id) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const price = priceForItemId(id);
    if (price == null) continue;
    const label = (VENDOR_BILL_ITEMS as any).find((x: any) => x.id === id)?.label ?? id;
    safeLineItems.push({ id, label, qty: Math.floor(qty), price });
  }

  if (safeLineItems.length === 0) {
    return NextResponse.json({ error: 'No valid line items' }, { status: 400 });
  }

  const subtotal = safeLineItems.reduce((s, l) => s + l.price * l.qty, 0);
  const convenience_fee = 20;
  const total = subtotal + convenience_fee;

  const vendorName =
    session.role === 'vendor' ? VENDORS.find((v) => v.id === session.vendorId)?.name ?? null : String(order.vendor_name ?? null);

  // Best-effort vendor_id assignment (use order.vendor_id if present).
  const vendor_id = order.vendor_id ?? null;

  const user_id = order.user_id ?? null;
  let customer_name: string | null = null;
  let customer_phone: string | null = null;
  if (user_id) {
    const { data: urow } = await supabase
      .from('users')
      .select('full_name, email, phone')
      .eq('id', user_id)
      .maybeSingle();
    if (urow) {
      customer_name = (urow.full_name as string | null) ?? (urow.email as string | null) ?? null;
      customer_phone = (urow.phone as string | null) ?? null;
    }
  }

  const { data, error } = await supabase
    .from('vendor_bills')
    .insert({
      order_id: order.id,
      order_token: token,
      order_number: body.order_number ?? order.order_number ?? null,
      customer_name,
      customer_phone,
      user_id,
      line_items: safeLineItems.map((l) => ({ id: l.id, label: l.label, price: l.price, qty: l.qty })),
      subtotal,
      convenience_fee,
      total,
      vendor_name: vendorName,
      vendor_id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, billId: data?.id });
}

