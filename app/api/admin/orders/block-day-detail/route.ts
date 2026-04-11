import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { formatIstYmd } from '@/lib/ist-dates';
import { normalizeHostelBlockKey } from '@/lib/hostel-block';

type BillRow = {
  id: string;
  order_id: string | null;
  order_token: string;
  line_items: unknown;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_reg_no: string | null;
  customer_hostel_block: string | null;
  customer_room_number: string | null;
  created_at: string;
};

function lineQtySum(line_items: unknown): number {
  if (!Array.isArray(line_items)) return 0;
  return line_items.reduce((s, elem: unknown) => {
    const e = elem as { qty?: unknown; quantity?: unknown };
    const q = Number(e?.qty ?? e?.quantity ?? 0);
    return s + (Number.isFinite(q) ? q : 0);
  }, 0);
}

function deliveryIstDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatIstYmd(new Date(iso));
}

function normalizeTokenKey(t: string): string {
  return String(t ?? '')
    .replace(/^#+/g, '')
    .trim()
    .toLowerCase();
}

/** One bill per order token (newest created_at), aligned with revenue RPCs. */
function latestBillPerToken(rows: BillRow[]): Map<string, BillRow> {
  const sorted = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const map = new Map<string, BillRow>();
  for (const b of sorted) {
    const k = normalizeTokenKey(b.order_token);
    if (!map.has(k)) map.set(k, b);
  }
  return map;
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const date = (url.searchParams.get('date') ?? '').trim();
  const blockKeyRaw = (url.searchParams.get('block_key') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date (use YYYY-MM-DD)' }, { status: 400 });
  }
  if (!blockKeyRaw) {
    return NextResponse.json({ error: 'Missing block_key' }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const vendorSlug = session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;
  if (!vendorSlug) {
    return NextResponse.json({ error: 'Vendor session required' }, { status: 403 });
  }

  const vendorRes = await supabase.from('vendors').select('id').eq('slug', vendorSlug).single();
  if (vendorRes.error || !vendorRes.data) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }
  const vendorDbId = vendorRes.data.id as string;

  const targetKey = blockKeyRaw === 'No block' ? 'No block' : blockKeyRaw;

  const { data: ordersRaw, error: ordErr } = await supabase
    .from('orders')
    .select('id, token, order_number, user_id, delivery_confirmed_at, updated_at')
    .eq('status', 'delivered')
    .eq('vendor_id', vendorDbId)
    .order('updated_at', { ascending: false })
    .limit(4000);
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

  const ordersOnDay = (ordersRaw ?? []).filter((o) => {
    const raw = o.delivery_confirmed_at ?? o.updated_at;
    return deliveryIstDate(raw) === date;
  });

  if (ordersOnDay.length === 0) {
    return NextResponse.json({ ok: true, date, block_key: targetKey, rows: [] });
  }

  const tokens = [...new Set(ordersOnDay.map((o) => String(o.token ?? '').trim()).filter(Boolean))];

  const { data: billsRaw, error: billErr } = await supabase
    .from('vendor_bills')
    .select(
      'id, order_id, order_token, line_items, total, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, created_at, cancelled_at',
    )
    .eq('vendor_id', vendorDbId)
    .is('cancelled_at', null)
    .in('order_token', tokens);

  if (billErr) return NextResponse.json({ error: billErr.message }, { status: 500 });

  const byToken = latestBillPerToken((billsRaw ?? []) as BillRow[]);

  const billByOrderId = new Map<string, BillRow>();
  const billByTokenNorm = new Map<string, BillRow>();
  for (const b of byToken.values()) {
    if (b.order_id) billByOrderId.set(String(b.order_id), b);
    billByTokenNorm.set(normalizeTokenKey(b.order_token), b);
  }

  const rows: Array<{
    order_id: string;
    token: string;
    order_number: string | null;
    customer_name: string;
    customer_phone: string;
    customer_reg_no: string;
    customer_hostel_block: string;
    customer_room_number: string;
    item_qty: number;
    total: number;
  }> = [];

  for (const o of ordersOnDay) {
    const bill =
      (o.id ? billByOrderId.get(String(o.id)) : null) ?? billByTokenNorm.get(normalizeTokenKey(String(o.token)));
    if (!bill) continue;

    const rollupKey = normalizeHostelBlockKey(bill.customer_hostel_block);
    if (rollupKey !== targetKey) continue;

    const name = bill.customer_name?.trim() || '—';
    const phone = bill.customer_phone?.trim() || '—';
    const reg = bill.customer_reg_no?.trim() || '—';
    const block = bill.customer_hostel_block?.trim() || '—';
    const room = bill.customer_room_number?.trim() || '—';
    const itemQty = lineQtySum(bill.line_items);
    const total = Number(bill.total);

    rows.push({
      order_id: o.id,
      token: String(o.token ?? ''),
      order_number: o.order_number ?? null,
      customer_name: name,
      customer_phone: phone,
      customer_reg_no: reg,
      customer_hostel_block: block,
      customer_room_number: room,
      item_qty: itemQty,
      total: Math.round(total * 100) / 100,
    });
  }

  rows.sort((a, b) => a.token.localeCompare(b.token));

  return NextResponse.json({ ok: true, date, block_key: targetKey, rows });
}
