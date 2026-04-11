import type { VendorDashboardMetrics } from '@/lib/vendor-dashboard-types';

function num(x: unknown, fallback = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function str(x: unknown): string {
  return x == null ? '' : String(x);
}

function dayRow(r: unknown): VendorDashboardMetrics['billed_7d']['by_date'][0] | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const date = str(o.date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    date,
    bill_count: num(o.bill_count),
    item_qty_sum: num(o.item_qty_sum),
    subtotal: num(o.subtotal),
    convenience_fee: num(o.convenience_fee),
    total: num(o.total),
  };
}

function legacyDayRow(r: unknown): { date: string; bill_count: number; total: number } | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const date = str(o.date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { date, bill_count: num(o.bill_count), total: num(o.total) };
}

function parseBilledSlice(
  x: unknown,
): Pick<
  VendorDashboardMetrics['billed_7d'],
  'total' | 'bill_count' | 'item_qty_sum' | 'subtotal' | 'convenience_fee' | 'by_date'
> | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const by = Array.isArray(o.by_date) ? o.by_date.map(dayRow).filter(Boolean) as VendorDashboardMetrics['billed_7d']['by_date'] : [];
  return {
    total: num(o.total),
    bill_count: num(o.bill_count),
    item_qty_sum: num(o.item_qty_sum),
    subtotal: num(o.subtotal),
    convenience_fee: num(o.convenience_fee),
    by_date: by,
  };
}

function parseCollectedBlockRow(r: unknown): VendorDashboardMetrics['collected_by_block'][0] | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const delivery_date = str(o.delivery_date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) return null;
  return {
    delivery_date,
    block_key: str(o.block_key) || 'No block',
    bill_count: num(o.bill_count),
    item_qty_sum: num(o.item_qty_sum),
    subtotal: num(o.subtotal),
    convenience_fee: num(o.convenience_fee),
    total: num(o.total),
  };
}

function parseBilledBlockRow(r: unknown): VendorDashboardMetrics['billed_by_block'][0] | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const bill_date = str(o.bill_date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bill_date)) return null;
  return {
    bill_date,
    block_key: str(o.block_key) || 'No block',
    bill_count: num(o.bill_count),
    item_qty_sum: num(o.item_qty_sum),
    subtotal: num(o.subtotal),
    convenience_fee: num(o.convenience_fee),
    total: num(o.total),
  };
}

/** Maps API JSON to dashboard metrics; fills safe defaults so older backends stay usable. */
export function normalizeVendorDashboardPayload(raw: unknown): VendorDashboardMetrics | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const b7 = parseBilledSlice(o.billed_7d);
  const b30 = parseBilledSlice(o.billed_30d);
  const c7 = parseBilledSlice(o.collected_7d);
  const c30 = parseBilledSlice(o.collected_30d);
  if (!b7 || !b30 || !c7 || !c30) return null;

  const rev7 = o.revenue_7d;
  const rev30 = o.revenue_30d;
  if (!rev7 || typeof rev7 !== 'object' || !rev30 || typeof rev30 !== 'object') return null;
  const r7 = rev7 as Record<string, unknown>;
  const r30 = rev30 as Record<string, unknown>;
  const rev7days = Array.isArray(r7.by_date)
    ? (r7.by_date.map(legacyDayRow).filter(Boolean) as VendorDashboardMetrics['revenue_7d']['by_date'])
    : [];
  const rev30days = Array.isArray(r30.by_date)
    ? (r30.by_date.map(legacyDayRow).filter(Boolean) as VendorDashboardMetrics['revenue_30d']['by_date'])
    : [];

  const collected_by_block = Array.isArray(o.collected_by_block)
    ? (o.collected_by_block.map(parseCollectedBlockRow).filter(Boolean) as VendorDashboardMetrics['collected_by_block'])
    : [];

  const billed_by_block = Array.isArray(o.billed_by_block)
    ? (o.billed_by_block.map(parseBilledBlockRow).filter(Boolean) as VendorDashboardMetrics['billed_by_block'])
    : [];

  const ot = o.open_tokens;
  let open_tokens: VendorDashboardMetrics['open_tokens'] = { count: 0, by_status: {} };
  if (ot && typeof ot === 'object') {
    const ox = ot as Record<string, unknown>;
    const by = ox.by_status;
    open_tokens = {
      count: num(ox.count),
      by_status: by && typeof by === 'object' && !Array.isArray(by) ? { ...(by as Record<string, number>) } : {},
    };
  }

  const d7 = o.delivered_7d;
  const d30 = o.delivered_30d;
  if (!d7 || typeof d7 !== 'object' || !d30 || typeof d30 !== 'object') return null;
  const dx7 = d7 as Record<string, unknown>;
  const dx30 = d30 as Record<string, unknown>;
  const delivered_7d = {
    count: num(dx7.count),
    by_date: Array.isArray(dx7.by_date)
      ? (dx7.by_date
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const z = row as Record<string, unknown>;
            const date = str(z.date).slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
            return { date, count: num(z.count) };
          })
          .filter(Boolean) as VendorDashboardMetrics['delivered_7d']['by_date'])
      : [],
  };
  const delivered_30d = {
    count: num(dx30.count),
    by_date: Array.isArray(dx30.by_date)
      ? (dx30.by_date
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const z = row as Record<string, unknown>;
            const date = str(z.date).slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
            return { date, count: num(z.count) };
          })
          .filter(Boolean) as VendorDashboardMetrics['delivered_30d']['by_date'])
      : [],
  };

  return {
    revenue_7d: { total: num(r7.total), bill_count: num(r7.bill_count), by_date: rev7days },
    revenue_30d: { total: num(r30.total), bill_count: num(r30.bill_count), by_date: rev30days },
    billed_7d: b7,
    billed_30d: b30,
    collected_7d: c7,
    collected_30d: c30,
    collected_by_block,
    billed_by_block,
    open_tokens,
    delivered_7d,
    delivered_30d,
  };
}
