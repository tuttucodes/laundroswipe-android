import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { mergeVendorBillItemsFromDbRow } from '@/lib/vendor-bill-catalog';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';
import { getVendorBillOverridesCached, getVendorsListCached } from '@/lib/supabase-metadata-cache';
import { allowInWindow } from '@/lib/server-usage-guards';
import { makeBillIdempotencyKey, stableLineItemsFingerprint } from '@/lib/bill-idempotency';
import { getSavedIdempotentResponse, saveIdempotentResponse } from '@/lib/api-idempotency-store';
import { logApiUsageDaily } from '@/lib/server-usage-log';

function resolveVendorSlugFromName(vendorName: string | null | undefined): string | null {
  const normalized = String(vendorName ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const match = VENDORS.find((vendor) => {
    const candidate = vendor.name.toLowerCase();
    return normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized);
  });
  return match?.id ?? null;
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ipKey = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowInWindow(`vendor-bills-save:${session.role}:${ipKey}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Too many save requests, please retry shortly' }, { status: 429 });
  }

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

  const tokenLookup = stripLeadingHashesFromToken(body.token ?? '').toLowerCase();
  if (!tokenLookup) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
  if (lineItems.length === 0) return NextResponse.json({ error: 'line_items is required' }, { status: 400 });

  // === Batch 1: order + vendors (cached list — avoids repeat full-table reads on slow links) ===
  const [orderRes, vendorsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, token, user_id, vendor_id, vendor_name')
      .ilike('token', tokenLookup)
      .limit(1),
    getVendorsListCached(supabase),
  ]);

  if (orderRes.error) return NextResponse.json({ error: orderRes.error.message }, { status: 500 });
  if (vendorsRes.error) return NextResponse.json({ error: vendorsRes.error.message }, { status: 500 });
  const order = Array.isArray(orderRes.data) ? orderRes.data[0] : null;
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (session.role === 'vendor') {
    const vendorSlug = session.vendorId?.toLowerCase().trim() ?? '';
    const orderVendorSlug = resolveVendorSlugFromName(order.vendor_name);
    if (orderVendorSlug && orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const vendorsBySlug = new Map<string, { id: string; slug: string; name: string }>();
  const vendorsById = new Map<string, { id: string; slug: string; name: string }>();
  for (const row of vendorsRes.data) {
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

  const billOrderTokenEarly = stripLeadingHashesFromToken(String(order.token ?? tokenLookup));

  // === Batch 2: profile overrides (cached) + user + latest active bill in parallel ===
  const [profOverrides, userRes, existingBillRes] = await Promise.all([
    getVendorBillOverridesCached(supabase, effectiveVendorSlug),
    order.user_id
      ? supabase
          .from('users')
          .select('full_name, email, phone, reg_no, hostel_block, room_number')
          .eq('id', order.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('vendor_bills')
      .select('id, line_items, subtotal, total')
      .ilike('order_token', billOrderTokenEarly)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const billOverrides = profOverrides.bill_item_overrides ?? {};
  if (userRes.error) return NextResponse.json({ error: userRes.error.message }, { status: 500 });

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
      return t.startsWith('http://') || t.startsWith('https://') ? t : null;
    };
    const fromClient = validImg(rawImage);
    const fromCatalog = !isCustomItem ? validImg(catRow?.image_url ?? null) : null;
    const image_url = fromClient ?? fromCatalog ?? null;

    safeLineItems.push({ id, label, qty: Math.floor(qty), price, image_url });
  }

  if (safeLineItems.length === 0) {
    return NextResponse.json({ error: 'No valid line items' }, { status: 400 });
  }
  const lineItemsFingerprint = stableLineItemsFingerprint(safeLineItems);

  const subtotal = safeLineItems.reduce((s, l) => s + l.price * l.qty, 0);
  const convenience_fee = 0;
  const total = subtotal;

  const vendorFromSlug = effectiveVendorSlug ? vendorsBySlug.get(effectiveVendorSlug) : null;
  const vendorNameFromConstants = effectiveVendorSlug
    ? VENDORS.find((v) => v.id === effectiveVendorSlug)?.name ?? null
    : null;
  const vendorName =
    vendorFromSlug?.name ??
    vendorNameFromConstants ??
    (session.role === 'vendor' ? session.vendorId ?? null : null) ??
    (order.vendor_name ? String(order.vendor_name) : null);

  const vendor_id = order.vendor_id ?? vendorFromSlug?.id ?? null;

  const user_id = order.user_id ?? null;
  const urow = userRes.data as { full_name?: string | null; email?: string | null; phone?: string | null; reg_no?: string | null; hostel_block?: string | null; room_number?: string | null } | null;
  const customer_name = urow ? ((urow.full_name as string | null) ?? (urow.email as string | null) ?? null) : null;
  const customer_phone = urow ? ((urow.phone as string | null) ?? null) : null;
  const customer_reg_no = urow?.reg_no != null ? String(urow.reg_no).trim() || null : null;
  const customer_hostel_block = urow?.hostel_block != null ? String(urow.hostel_block).trim() || null : null;
  const customer_room_number = urow?.room_number != null ? String(urow.room_number).trim() || null : null;

  const newLineItemsPayload = safeLineItems.map((l) => ({ id: l.id, label: l.label, price: l.price, qty: l.qty, image_url: l.image_url }));

  const billOrderToken = billOrderTokenEarly;
  const vendorScope = session.role === 'vendor' ? String(session.vendorId ?? 'vendor') : 'super_admin';
  const idempotencyKey = makeBillIdempotencyKey({
    vendorScope,
    operation: 'vendor_bills_save',
    token: billOrderToken,
    lineItemsFingerprint,
  });
  const savedResponse = await getSavedIdempotentResponse(supabase as any, idempotencyKey);
  if (savedResponse) return NextResponse.json(savedResponse);

  // Latest active bill (fetched in batch 2). Retry without cancelled_at if column missing.
  let resolvedExistingBillRes = existingBillRes;
  if (resolvedExistingBillRes.error?.code === '42703') {
    resolvedExistingBillRes = await supabase
      .from('vendor_bills')
      .select('id, line_items, subtotal, total')
      .ilike('order_token', billOrderToken)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  }

  if (resolvedExistingBillRes.error) {
    return NextResponse.json({ error: resolvedExistingBillRes.error.message }, { status: 500 });
  }

  type ExistingBill = { id: string; line_items: unknown; subtotal: number; total: number };
  let existingBill: ExistingBill | null = (resolvedExistingBillRes.data ?? null) as ExistingBill | null;

  if (existingBill) {
    const eb = existingBill;
    const existingItems = Array.isArray(eb.line_items) ? eb.line_items as Array<{ id: string; qty: number; price: number }> : [];
    const normalize = (items: Array<{ id: string; qty: number; price: number }>) =>
      [...items].sort((a, b) => a.id.localeCompare(b.id)).map((i) => `${i.id}:${i.qty}:${i.price}`).join('|');
    const existingFingerprint = normalize(existingItems);
    const newFingerprint = normalize(newLineItemsPayload);

    if (existingFingerprint === newFingerprint) {
      const payload = { ok: true, billId: eb.id, reused: true };
      await saveIdempotentResponse(supabase as any, idempotencyKey, '/api/vendor/bills/save', payload);
      void logApiUsageDaily(supabase as any, '/api/vendor/bills/save', JSON.stringify(payload).length);
      return NextResponse.json(payload);
    }

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
      .eq('id', eb.id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    const payload = { ok: true, billId: eb.id, updated: true };
    await saveIdempotentResponse(supabase as any, idempotencyKey, '/api/vendor/bills/save', payload);
    void logApiUsageDaily(supabase as any, '/api/vendor/bills/save', JSON.stringify(payload).length);
    return NextResponse.json(payload);
  }

  // No existing active bill — insert (unique index on token may race; handle 23505)
  const { data, error } = await supabase
    .from('vendor_bills')
    .insert({
      order_id: order.id,
      order_token: billOrderToken,
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

  if (!error) {
    const payload = { ok: true, billId: data?.id, created: true };
    await saveIdempotentResponse(supabase as any, idempotencyKey, '/api/vendor/bills/save', payload);
    void logApiUsageDaily(supabase as any, '/api/vendor/bills/save', JSON.stringify(payload).length);
    return NextResponse.json(payload);
  }

  if (error.code === '23505') {
    const { data: row, error: fetchErr } = await supabase
      .from('vendor_bills')
      .select('id, line_items, subtotal, total')
      .ilike('order_token', billOrderToken)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr || !row) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const conflictBill = row as ExistingBill;
    const existingItems = Array.isArray(conflictBill.line_items)
      ? (conflictBill.line_items as Array<{ id: string; qty: number; price: number }>)
      : [];
    const normalize = (items: Array<{ id: string; qty: number; price: number }>) =>
      [...items].sort((a, b) => a.id.localeCompare(b.id)).map((i) => `${i.id}:${i.qty}:${i.price}`).join('|');
    if (normalize(existingItems) === normalize(newLineItemsPayload)) {
      const payload = { ok: true, billId: conflictBill.id, reused: true };
      await saveIdempotentResponse(supabase as any, idempotencyKey, '/api/vendor/bills/save', payload);
      void logApiUsageDaily(supabase as any, '/api/vendor/bills/save', JSON.stringify(payload).length);
      return NextResponse.json(payload);
    }
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
      .eq('id', conflictBill.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    const payload = { ok: true, billId: conflictBill.id, updated: true };
    await saveIdempotentResponse(supabase as any, idempotencyKey, '/api/vendor/bills/save', payload);
    void logApiUsageDaily(supabase as any, '/api/vendor/bills/save', JSON.stringify(payload).length);
    return NextResponse.json(payload);
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
