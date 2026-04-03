import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { applyServiceFeeDiscount } from '@/lib/fees';
import { mergeVendorBillItemsFromDbRow } from '@/lib/vendor-bill-catalog';

type DbVendor = { id: string; slug: string; name: string };

function resolveVendorSlugFromName(vendorName: string | null | undefined, dbVendors: DbVendor[]): string | null {
  const v = (vendorName ?? '').toLowerCase().trim();
  if (!v) return null;
  const dbMatch = dbVendors.find((x) => v.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(v));
  if (dbMatch) return dbMatch.slug;
  const match = VENDORS.find((x) => v.includes(x.name.toLowerCase()) || v === x.name.toLowerCase());
  return match?.id ?? null;
}

function resolveBillVendorSlug(
  bill: { vendor_id?: string | null; vendor_name?: string | null },
  vendorsById: Map<string, string>,
  dbVendors: DbVendor[],
): string | null {
  const byId = bill.vendor_id ? vendorsById.get(String(bill.vendor_id)) : null;
  const byName = resolveVendorSlugFromName(bill.vendor_name, dbVendors);
  return (byId ?? byName ?? null)?.toLowerCase().trim() || null;
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: {
    bill_id?: string;
    line_items?: Array<{
      id: string;
      qty: number;
      label?: string | null;
      price?: number | string | null;
      image_url?: string | null;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const billId = String(body.bill_id ?? '').trim();
  if (!billId) return NextResponse.json({ error: 'bill_id is required' }, { status: 400 });

  const lineItemsIn = Array.isArray(body.line_items) ? body.line_items : [];
  if (lineItemsIn.length === 0) return NextResponse.json({ error: 'line_items is required' }, { status: 400 });

  const { data: vendorsData } = await supabase.from('vendors').select('id, slug, name');
  const dbVendors = (vendorsData ?? []) as DbVendor[];
  const vendorsById = new Map<string, string>(dbVendors.map((v) => [String(v.id), v.slug]));

  const { data: bill, error: fetchErr } = await supabase
    .from('vendor_bills')
    .select('id, vendor_id, vendor_name, created_at, line_items')
    .eq('id', billId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

  const billVendorSlug = resolveBillVendorSlug(bill, vendorsById, dbVendors);

  if (session.role === 'vendor') {
    const sessionVendorSlug = String(session.vendorId ?? '').toLowerCase().trim();
    if (!billVendorSlug || billVendorSlug !== sessionVendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let billOverrides: unknown = {};
  if (billVendorSlug) {
    const { data: prof } = await supabase
      .from('vendor_profiles')
      .select('bill_item_overrides')
      .eq('slug', billVendorSlug)
      .maybeSingle();
    billOverrides = prof?.bill_item_overrides ?? {};
  }
  const mergedCatalog = mergeVendorBillItemsFromDbRow(billVendorSlug, billOverrides);
  const existingRows = Array.isArray(bill.line_items)
    ? (bill.line_items as { id: string; label: string; price: number; qty: number; image_url?: string | null }[])
    : [];
  const existingById = new Map(existingRows.map((x) => [x.id, x]));

  const safeLineItems: Array<{
    id: string;
    label: string;
    qty: number;
    price: number;
    image_url?: string | null;
  }> = [];
  for (const li of lineItemsIn) {
    const id = String(li?.id ?? '').trim();
    const qty = Number(li?.qty ?? 0);
    if (!id) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const catRow = mergedCatalog.find((x) => x.id === id);
    let price = catRow ? Number(catRow.price) : null;
    let label: string | undefined = catRow ? String(catRow.label) : undefined;
    const inputLabel = String((li as { label?: string | null }).label ?? '').trim();
    const inputPrice = Number((li as { price?: number | string | null }).price ?? NaN);

    if (price == null) {
      const prev = existingById.get(id);
      if (prev && typeof prev.price === 'number' && prev.label) {
        price = Number(prev.price);
        label = String(prev.label);
      } else {
        if (Number.isFinite(inputPrice) && inputPrice > 0) price = inputPrice;
        if (inputLabel) label = inputLabel;
      }
    }
    if (price == null || !label) continue;
    const prev = existingById.get(id) as unknown as { image_url?: string | null } | undefined;
    const rawInputImage = (li as { image_url?: string | null }).image_url;
    const validImg = (s: string | null | undefined) => {
      const t = String(s ?? '').trim();
      if (!t) return null;
      return t.startsWith('data:image/') || t.startsWith('http://') || t.startsWith('https://') ? t : null;
    };
    const catalogImg = catRow ? validImg(catRow.image_url) : null;
    const image_url =
      rawInputImage === undefined
        ? validImg(prev?.image_url ?? null) ?? catalogImg
        : validImg(String(rawInputImage ?? ''));

    safeLineItems.push({ id, label, qty: Math.floor(qty), price, image_url });
  }

  if (safeLineItems.length === 0) {
    return NextResponse.json({ error: 'No valid line items' }, { status: 400 });
  }

  const subtotal = safeLineItems.reduce((s, l) => s + l.price * l.qty, 0);
  const convenience_fee = applyServiceFeeDiscount(subtotal).finalFee;
  const total = subtotal + convenience_fee;

  const { error: updErr } = await supabase
    .from('vendor_bills')
    .update({
      line_items: safeLineItems.map((l) => ({
        id: l.id,
        label: l.label,
        price: l.price,
        qty: l.qty,
        image_url: l.image_url ?? null,
      })),
      subtotal,
      convenience_fee,
      total,
    })
    .eq('id', billId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
