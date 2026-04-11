import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { formatIstYmd, istYmdEndIso, istYmdStartIso } from '@/lib/ist-dates';
import { rollupHostelBlockKey } from '@/lib/hostel-block';
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
  const rangeFrom = (url.searchParams.get('block_from') ?? '').trim();
  const rangeTo = (url.searchParams.get('block_to') ?? '').trim();

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

  const now = new Date();
  const msDay = 24 * 60 * 60 * 1000;
  const istToday = formatIstYmd(now);
  const ist30Start = formatIstYmd(new Date(now.getTime() - 29 * msDay));
  const fromYmd = rangeFrom && /^\d{4}-\d{2}-\d{2}$/.test(rangeFrom) ? rangeFrom : ist30Start;
  const toYmd = rangeTo && /^\d{4}-\d{2}-\d{2}$/.test(rangeTo) ? rangeTo : istToday;
  const rangeStart = istYmdStartIso(fromYmd);
  const rangeEnd = istYmdEndIso(toYmd);

  const { data: billData, error: billErr } = await supabase
    .from('vendor_bills')
    .select(
      'id, order_id, order_token, line_items, total, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, created_at, cancelled_at',
    )
    .eq('vendor_id', vendorDbId)
    .is('cancelled_at', null)
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);

  if (billErr) return NextResponse.json({ error: billErr.message }, { status: 500 });

  const billRows = (billData ?? []) as BillRow[];
  const byToken = latestBillPerToken(billRows);
  const dayBills = [...byToken.values()].filter((b) => formatIstYmd(new Date(b.created_at)) === date);

  if (dayBills.length === 0) {
    return NextResponse.json({
      ok: true,
      date,
      block_key: targetKey,
      rows: [],
      bills_in_range_on_day: 0,
      rows_matched: 0,
    });
  }

  const orderIds = new Set<string>();
  const tokenKeys = new Set<string>();
  for (const b of dayBills) {
    if (b.order_id) orderIds.add(String(b.order_id));
    else {
      const k = normalizeTokenKey(b.order_token);
      if (k) tokenKeys.add(k);
    }
  }

  type OrderRow = {
    id: string;
    token: string;
    order_number: string | null;
    user_id: string | null;
  };
  const orderById = new Map<string, OrderRow>();
  const orderByTokenNorm = new Map<string, OrderRow>();

  try {
    await inChunks([...orderIds], async (chunk) => {
      if (chunk.length === 0) return;
      const { data, error } = await supabase
        .from('orders')
        .select('id, token, order_number, user_id')
        .eq('vendor_id', vendorDbId)
        .in('id', chunk);
      if (error) throw new Error(error.message);
      for (const o of (data ?? []) as OrderRow[]) {
        if (o?.id) orderById.set(String(o.id), o);
      }
    });

    const tokenVariantList = [...tokenKeys].flatMap((k) => {
      const sample = dayBills.find((b) => normalizeTokenKey(b.order_token) === k)?.order_token ?? k;
      return tokenVariants(sample);
    });
    const uniqVariants = [...new Set(tokenVariantList)];

    await inChunks(uniqVariants, async (chunk) => {
      if (chunk.length === 0) return;
      const { data, error } = await supabase
        .from('orders')
        .select('id, token, order_number, user_id')
        .eq('vendor_id', vendorDbId)
        .in('token', chunk);
      if (error) throw new Error(error.message);
      for (const o of (data ?? []) as OrderRow[]) {
        const norm = normalizeTokenKey(String(o.token ?? ''));
        if (!norm) continue;
        if (!orderByTokenNorm.has(norm)) orderByTokenNorm.set(norm, o);
      }
    });

    type UserRow = { id: string; reg_no: string | null; hostel_block: string | null; room_number: string | null };
    const userIds = new Set<string>();
    for (const b of dayBills) {
      const oid = b.order_id ? String(b.order_id) : null;
      const o = oid ? orderById.get(oid) : orderByTokenNorm.get(normalizeTokenKey(b.order_token));
      if (o?.user_id) userIds.add(String(o.user_id));
    }

    const userById = new Map<string, UserRow>();
    if (userIds.size > 0) {
      await inChunks([...userIds], async (chunk) => {
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

    for (const b of dayBills) {
      const oid = b.order_id ? String(b.order_id) : null;
      const o =
        (oid ? orderById.get(oid) : null) ?? orderByTokenNorm.get(normalizeTokenKey(b.order_token));
      const u = o?.user_id ? userById.get(String(o.user_id)) : undefined;
      const rollupKey = rollupHostelBlockKey(b.customer_hostel_block, u?.hostel_block);
      if (rollupKey !== targetKey) continue;

      const phone = b.customer_phone?.trim() || '—';
      const itemQty = lineQtySum(b.line_items);
      const total = Number(b.total);

      const merged = segregateCustomerDisplay({
        customer_name: b.customer_name?.trim() || '',
        customer_reg_no: b.customer_reg_no?.trim() || u?.reg_no?.trim() || '',
        customer_hostel_block: b.customer_hostel_block?.trim() || u?.hostel_block?.trim() || '',
        customer_room_number: b.customer_room_number?.trim() || u?.room_number?.trim() || '',
      });

      rows.push({
        order_id: o?.id ?? '',
        token: String(b.order_token ?? ''),
        order_number: o?.order_number ?? null,
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
      bills_in_range_on_day: dayBills.length,
      rows_matched: rows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load bill day block detail';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
