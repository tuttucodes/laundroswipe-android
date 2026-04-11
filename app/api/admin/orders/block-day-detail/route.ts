import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { addDaysYmd, istYmdStartIso } from '@/lib/ist-dates';
import { normalizeHostelBlockKey } from '@/lib/hostel-block';
import { segregateCustomerDisplay } from '@/lib/customer-display-segregate';

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

function normalizeTokenKey(t: string): string {
  return String(t ?? '')
    .replace(/^#+/g, '')
    .trim()
    .toLowerCase();
}

function tokenVariants(raw: string): string[] {
  const t = String(raw ?? '').trim();
  if (!t) return [];
  const base = t.replace(/^#+/g, '');
  const out = new Set<string>();
  out.add(t);
  out.add(base);
  out.add(`#${base}`);
  out.add(`#${base}`.toUpperCase());
  out.add(base.toUpperCase());
  return [...out];
}

/** Newest bill per normalized token (matches revenue / block RPCs). */
function latestBillPerToken(rows: BillRow[]): Map<string, BillRow> {
  const sorted = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const map = new Map<string, BillRow>();
  for (const b of sorted) {
    const k = normalizeTokenKey(b.order_token);
    if (!k) continue;
    if (!map.has(k)) map.set(k, b);
  }
  return map;
}

const CHUNK = 100;

async function inChunks<T>(items: T[], fn: (chunk: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    await fn(items.slice(i, i + CHUNK));
  }
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

  const dayStart = istYmdStartIso(date);
  const dayNextStart = istYmdStartIso(addDaysYmd(date, 1));
  const sel = 'id, token, order_number, user_id, delivery_confirmed_at, updated_at';

  const [confirmedRes, fallbackRes] = await Promise.all([
    supabase
      .from('orders')
      .select(sel)
      .eq('status', 'delivered')
      .eq('vendor_id', vendorDbId)
      .not('delivery_confirmed_at', 'is', null)
      .gte('delivery_confirmed_at', dayStart)
      .lt('delivery_confirmed_at', dayNextStart),
    supabase
      .from('orders')
      .select(sel)
      .eq('status', 'delivered')
      .eq('vendor_id', vendorDbId)
      .is('delivery_confirmed_at', null)
      .gte('updated_at', dayStart)
      .lt('updated_at', dayNextStart),
  ]);

  if (confirmedRes.error) return NextResponse.json({ error: confirmedRes.error.message }, { status: 500 });
  if (fallbackRes.error) return NextResponse.json({ error: fallbackRes.error.message }, { status: 500 });

  const byId = new Map<string, (typeof confirmedRes.data)[0]>();
  for (const o of confirmedRes.data ?? []) {
    if (o?.id) byId.set(String(o.id), o);
  }
  for (const o of fallbackRes.data ?? []) {
    if (o?.id) byId.set(String(o.id), o);
  }
  const ordersOnDay = [...byId.values()];
  if (ordersOnDay.length === 0) {
    return NextResponse.json({
      ok: true,
      date,
      block_key: targetKey,
      rows: [],
      orders_on_day: 0,
      rows_matched: 0,
    });
  }

  const orderIds = [...new Set(ordersOnDay.map((o) => o.id).filter(Boolean))] as string[];
  const tokenSet = new Set<string>();
  for (const o of ordersOnDay) {
    for (const v of tokenVariants(String(o.token ?? ''))) {
      if (v) tokenSet.add(v);
    }
  }
  const tokenList = [...tokenSet];

  const billRows: BillRow[] = [];

  try {
    await inChunks(orderIds, async (chunk) => {
      if (chunk.length === 0) return;
      const { data, error } = await supabase
        .from('vendor_bills')
        .select(
          'id, order_id, order_token, line_items, total, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, created_at, cancelled_at',
        )
        .eq('vendor_id', vendorDbId)
        .is('cancelled_at', null)
        .in('order_id', chunk);
      if (error) throw new Error(error.message);
      billRows.push(...((data ?? []) as BillRow[]));
    });

    await inChunks(tokenList, async (chunk) => {
      if (chunk.length === 0) return;
      const { data, error } = await supabase
        .from('vendor_bills')
        .select(
          'id, order_id, order_token, line_items, total, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, created_at, cancelled_at',
        )
        .eq('vendor_id', vendorDbId)
        .is('cancelled_at', null)
        .in('order_token', chunk);
      if (error) throw new Error(error.message);
      billRows.push(...((data ?? []) as BillRow[]));
    });

    type UserRow = { id: string; reg_no: string | null; hostel_block: string | null; room_number: string | null };
    const userIds = [...new Set(ordersOnDay.map((o) => o.user_id).filter(Boolean))] as string[];
    const userById = new Map<string, UserRow>();
    if (userIds.length > 0) {
      await inChunks(userIds, async (chunk) => {
        if (chunk.length === 0) return;
        const { data, error } = await supabase
          .from('users')
          .select('id, reg_no, hostel_block, room_number')
          .in('id', chunk);
        if (error) throw new Error(error.message);
        for (const u of (data ?? []) as UserRow[]) {
          if (u?.id) userById.set(String(u.id), u);
        }
      });
    }

    const byToken = latestBillPerToken(billRows);

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

      const u = o.user_id ? userById.get(String(o.user_id)) : undefined;
      const phone = bill.customer_phone?.trim() || '—';
      const itemQty = lineQtySum(bill.line_items);
      const total = Number(bill.total);

      const merged = segregateCustomerDisplay({
        customer_name: bill.customer_name?.trim() || '',
        customer_reg_no: bill.customer_reg_no?.trim() || u?.reg_no?.trim() || '',
        customer_hostel_block: bill.customer_hostel_block?.trim() || u?.hostel_block?.trim() || '',
        customer_room_number: bill.customer_room_number?.trim() || u?.room_number?.trim() || '',
      });

      rows.push({
        order_id: o.id,
        token: String(o.token ?? ''),
        order_number: o.order_number ?? null,
        customer_name: merged.customer_name,
        customer_phone: phone,
        customer_reg_no: merged.customer_reg_no,
        customer_hostel_block: merged.customer_hostel_block,
        customer_room_number: merged.customer_room_number,
        item_qty: itemQty,
        total: Math.round(total * 100) / 100,
      });
    }

    rows.sort((a, b) => {
      const ba = a.customer_hostel_block.localeCompare(b.customer_hostel_block);
      if (ba !== 0) return ba;
      return a.token.localeCompare(b.token);
    });

    return NextResponse.json({
      ok: true,
      date,
      block_key: targetKey,
      rows,
      orders_on_day: ordersOnDay.length,
      rows_matched: rows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load block day detail';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
