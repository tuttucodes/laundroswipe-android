import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS, getVendorBillItems } from '@/lib/constants';
import { applyServiceFeeDiscount } from '@/lib/fees';

function resolveVendorSlugFromName(vendorName: string | null | undefined): string | null {
  const normalized = String(vendorName ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const match = VENDORS.find((vendor) => {
    const candidate = vendor.name.toLowerCase();
    return normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized);
  });
  return match?.id ?? null;
}

function normalizeToken(token: string): string {
  return String(token).replace(/^#/, '').trim();
}

function priceForItemId(itemId: string, vendorSlug: string | null): number | null {
  const item = getVendorBillItems(vendorSlug).find((i) => i.id === itemId);
  return item ? Number(item.price) : null;
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: {
    token?: string;
    line_items?: Array<{
      id: string;
      qty: number;
      label?: string | null;
      price?: number | string | null;
      image_url?: string | null;
    }>;
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
    const orderVendorSlug = resolveVendorSlugFromName(order.vendor_name);
    if (orderVendorSlug && orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data: dbVendors } = await supabase
    .from('vendors')
    .select('id, slug, name');
  const vendorsBySlug = new Map<string, { id: string; slug: string; name: string }>();
  const vendorsById = new Map<string, { id: string; slug: string; name: string }>();
  for (const row of dbVendors ?? []) {
    const v = row as { id: string; slug: string; name: string };
    vendorsBySlug.set(String(v.slug).toLowerCase().trim(), v);
    vendorsById.set(String(v.id), v);
  }

  const sessionVendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;
  const orderVendorSlug =
    (order.vendor_id ? vendorsById.get(String(order.vendor_id))?.slug : null) ??
    resolveVendorSlugFromName(order.vendor_name);
  const effectiveVendorSlug = (sessionVendorSlug ?? orderVendorSlug ?? null)?.toLowerCase().trim() || null;
  const vendorBillItems = getVendorBillItems(effectiveVendorSlug);

  const safeLineItems: Array<{ id: string; label: string; qty: number; price: number; image_url?: string | null }> = [];
  for (const li of lineItems) {
    const id = String(li?.id ?? '').trim();
    const qty = Number(li?.qty ?? 0);
    if (!id) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const catalogPrice = priceForItemId(id, effectiveVendorSlug);
    const catalogLabel = vendorBillItems.find((x) => x.id === id)?.label ?? null;
    const inputLabel = String((li as { label?: string | null }).label ?? '').trim();
    const inputPrice = Number((li as { price?: number | string | null }).price ?? NaN);

    const isCustomItem = catalogPrice == null;
    const price = isCustomItem ? (Number.isFinite(inputPrice) && inputPrice > 0 ? inputPrice : null) : catalogPrice;
    const label = isCustomItem ? (inputLabel || null) : String(catalogLabel ?? id);
    if (price == null || !label) continue;
    const rawImage = typeof (li as { image_url?: unknown }).image_url === 'string'
      ? String((li as { image_url?: string }).image_url).trim()
      : null;
    const image_url =
      rawImage && (rawImage.startsWith('data:image/') || rawImage.startsWith('http://') || rawImage.startsWith('https://'))
        ? rawImage
        : null;

    safeLineItems.push({ id, label, qty: Math.floor(qty), price, image_url });
  }

  if (safeLineItems.length === 0) {
    return NextResponse.json({ error: 'No valid line items' }, { status: 400 });
  }

  const subtotal = safeLineItems.reduce((s, l) => s + l.price * l.qty, 0);
  const convenience_fee = applyServiceFeeDiscount(subtotal).finalFee;
  const total = subtotal + convenience_fee;

  const vendorFromSlug = effectiveVendorSlug ? vendorsBySlug.get(effectiveVendorSlug) : null;
  const vendorNameFromConstants = effectiveVendorSlug
    ? VENDORS.find((v) => v.id === effectiveVendorSlug)?.name ?? null
    : null;
  const vendorName =
    vendorFromSlug?.name ??
    vendorNameFromConstants ??
    (session.role === 'vendor' ? session.vendorId ?? null : null) ??
    (order.vendor_name ? String(order.vendor_name) : null);

  // Best-effort vendor_id assignment.
  const vendor_id = order.vendor_id ?? vendorFromSlug?.id ?? null;

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
      line_items: safeLineItems.map((l) => ({ id: l.id, label: l.label, price: l.price, qty: l.qty, image_url: l.image_url })),
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

