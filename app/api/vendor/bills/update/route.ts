import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS, getVendorBillItems } from '@/lib/constants';
import { applyServiceFeeDiscount } from '@/lib/fees';
import { isWithinVendorBillCancelEditWindow } from '@/lib/vendor-bill-policy';

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

function priceForItemId(itemId: string, vendorSlug: string | null): number | null {
  const item = getVendorBillItems(vendorSlug).find((i) => i.id === itemId);
  return item ? Number(item.price) : null;
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: { bill_id?: string; line_items?: Array<{ id: string; qty: number }> };
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

  if (!isWithinVendorBillCancelEditWindow(String(bill.created_at))) {
    return NextResponse.json({ error: 'Edit window expired (1 hour after bill creation)' }, { status: 400 });
  }

  const billVendorSlug = resolveBillVendorSlug(bill, vendorsById, dbVendors);

  if (session.role === 'vendor') {
    const sessionVendorSlug = String(session.vendorId ?? '').toLowerCase().trim();
    if (!billVendorSlug || billVendorSlug !== sessionVendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const catalog = getVendorBillItems(billVendorSlug);
  const existingRows = Array.isArray(bill.line_items) ? (bill.line_items as { id: string; label: string; price: number; qty: number }[]) : [];
  const existingById = new Map(existingRows.map((x) => [x.id, x]));

  const safeLineItems: Array<{ id: string; label: string; qty: number; price: number }> = [];
  for (const li of lineItemsIn) {
    const id = String(li?.id ?? '').trim();
    const qty = Number(li?.qty ?? 0);
    if (!id) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    let price = priceForItemId(id, billVendorSlug);
    const catRow = catalog.find((x) => x.id === id);
    let label: string | undefined = catRow ? String(catRow.label) : undefined;
    if (price == null) {
      const prev = existingById.get(id);
      if (prev && typeof prev.price === 'number' && prev.label) {
        price = Number(prev.price);
        label = String(prev.label);
      }
    }
    if (price == null || !label) continue;
    safeLineItems.push({ id, label, qty: Math.floor(qty), price });
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
      line_items: safeLineItems.map((l) => ({ id: l.id, label: l.label, price: l.price, qty: l.qty })),
      subtotal,
      convenience_fee,
      total,
    })
    .eq('id', billId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
