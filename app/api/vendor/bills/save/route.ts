import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { applyServiceFeeDiscount } from '@/lib/fees';
import { mergeVendorBillItemsFromDbRow } from '@/lib/vendor-bill-catalog';

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

  let billOverrides: unknown = {};
  if (effectiveVendorSlug) {
    const { data: prof } = await supabase
      .from('vendor_profiles')
      .select('bill_item_overrides')
      .eq('slug', effectiveVendorSlug)
      .maybeSingle();
    billOverrides = prof?.bill_item_overrides ?? {};
  }
  const mergedCatalog = mergeVendorBillItemsFromDbRow(effectiveVendorSlug, billOverrides);

  const safeLineItems: Array<{ id: string; label: string; qty: number; price: number; image_url?: string | null }> = [];
  for (const li of lineItems) {
    const id = String(li?.id ?? '').trim();
    const qty = Number(li?.qty ?? 0);
    if (!id) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const catRow = mergedCatalog.find((x) => x.id === id);
    const catalogPrice = catRow ? Number(catRow.price) : null;
    const catalogLabel = catRow?.label ?? null;
    const inputLabel = String((li as { label?: string | null }).label ?? '').trim();
    const inputPrice = Number((li as { price?: number | string | null }).price ?? NaN);

    const isCustomItem = catalogPrice == null;
    const price = isCustomItem ? (Number.isFinite(inputPrice) && inputPrice > 0 ? inputPrice : null) : catalogPrice;
    const label = isCustomItem ? (inputLabel || null) : String(catalogLabel ?? id);
    if (price == null || !label) continue;
    const rawImage = typeof (li as { image_url?: unknown }).image_url === 'string'
      ? String((li as { image_url?: string }).image_url).trim()
      : null;
    const validImg = (s: string | null | undefined) => {
      const t = String(s ?? '').trim();
      if (!t) return null;
      return t.startsWith('data:image/') || t.startsWith('http://') || t.startsWith('https://') ? t : null;
    };
    const fromClient = validImg(rawImage);
    const fromCatalog = !isCustomItem ? validImg(catRow?.image_url ?? null) : null;
    const image_url = fromClient ?? fromCatalog ?? null;

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
  let customer_reg_no: string | null = null;
  let customer_hostel_block: string | null = null;
  let customer_room_number: string | null = null;
  if (user_id) {
    const { data: urow } = await supabase
      .from('users')
      .select('full_name, email, phone, reg_no, hostel_block, room_number')
      .eq('id', user_id)
      .maybeSingle();
    if (urow) {
      customer_name = (urow.full_name as string | null) ?? (urow.email as string | null) ?? null;
      customer_phone = (urow.phone as string | null) ?? null;
      customer_reg_no = urow.reg_no != null ? String(urow.reg_no).trim() || null : null;
      customer_hostel_block = urow.hostel_block != null ? String(urow.hostel_block).trim() || null : null;
      customer_room_number = urow.room_number != null ? String(urow.room_number).trim() || null : null;
    }
  }

  const newLineItemsPayload = safeLineItems.map((l) => ({ id: l.id, label: l.label, price: l.price, qty: l.qty, image_url: l.image_url }));

  // --- Upsert logic: check for existing active (non-cancelled) bill for this token ---
  type ExistingBill = { id: string; line_items: unknown; subtotal: number; total: number };
  const fetchExistingBill = async (): Promise<ExistingBill | null> => {
    const q1 = await supabase
      .from('vendor_bills')
      .select('id, line_items, subtotal, total')
      .eq('order_token', token)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (q1.error && q1.error.code === '42703') {
      // cancelled_at column doesn't exist yet — fallback without it
      const q2 = await supabase
        .from('vendor_bills')
        .select('id, line_items, subtotal, total')
        .eq('order_token', token)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (q2.error) throw new Error(q2.error.message);
      return (q2.data as ExistingBill) ?? null;
    }
    if (q1.error) throw new Error(q1.error.message);
    return (q1.data as ExistingBill) ?? null;
  };

  let existingBill: ExistingBill | null;
  try {
    existingBill = await fetchExistingBill();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to check existing bill' }, { status: 500 });
  }

  if (existingBill) {
    // Compare line items: same items+qty+price = identical bill, just return it
    const existingItems = Array.isArray(existingBill.line_items) ? existingBill.line_items as Array<{ id: string; qty: number; price: number }> : [];
    const normalize = (items: Array<{ id: string; qty: number; price: number }>) =>
      [...items].sort((a, b) => a.id.localeCompare(b.id)).map((i) => `${i.id}:${i.qty}:${i.price}`).join('|');
    const existingFingerprint = normalize(existingItems);
    const newFingerprint = normalize(newLineItemsPayload);

    if (existingFingerprint === newFingerprint) {
      // Identical bill already exists — return it without creating a duplicate
      return NextResponse.json({ ok: true, billId: existingBill.id, reused: true });
    }

    // Items changed — update the existing bill instead of creating a new one
    const { error: updErr } = await supabase
      .from('vendor_bills')
      .update({
        line_items: newLineItemsPayload,
        subtotal,
        convenience_fee,
        total,
        customer_name,
        customer_phone,
        customer_reg_no,
        customer_hostel_block,
        customer_room_number,
      })
      .eq('id', existingBill.id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, billId: existingBill.id, updated: true });
  }

  // No existing active bill — create a new one
  const { data, error } = await supabase
    .from('vendor_bills')
    .insert({
      order_id: order.id,
      order_token: token,
      order_number: body.order_number ?? order.order_number ?? null,
      customer_name,
      customer_phone,
      customer_reg_no,
      customer_hostel_block,
      customer_room_number,
      user_id,
      line_items: newLineItemsPayload,
      subtotal,
      convenience_fee,
      total,
      vendor_name: vendorName,
      vendor_id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, billId: data?.id, created: true });
}

