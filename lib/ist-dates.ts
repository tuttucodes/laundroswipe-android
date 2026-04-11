/** Calendar dates in Asia/Kolkata (YYYY-MM-DD). India has no DST. */

const TZ = 'Asia/Kolkata';

export function formatIstYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Start of calendar day `ymd` in Asia/Kolkata as ISO 8601 (timestamptz).
 * Use for RPC filters so "last 7 days" matches IST calendar rows in the UI.
 */
export function istYmdStartIso(ymd: string): string {
  return `${ymd}T00:00:00+05:30`;
}

/** Add days to a YYYY-MM-DD string (UTC date arithmetic on the calendar day). */
export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, dd] = ymd.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, dd + delta);
  return new Date(utc).toISOString().slice(0, 10);
}

export function eachYmdInRange(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  for (let cur = fromYmd; cur <= toYmd; cur = addDaysYmd(cur, 1)) {
    out.push(cur);
  }
  return out;
}

export type CollectedDayRow = {
  date: string;
  bill_count: number;
  item_qty_sum: number;
  subtotal: number;
  convenience_fee: number;
  total: number;
};

export function fillCollectedByDate(
  fromYmd: string,
  toYmd: string,
  rows: Array<{
    delivery_date: string;
    bill_count: number;
    item_qty_sum: number;
    subtotal_sum: number;
    convenience_fee_sum: number;
    total_sum: number;
  }>,
): CollectedDayRow[] {
  const map = new Map<string, CollectedDayRow>();
  for (const r of rows) {
    const key = String(r.delivery_date).slice(0, 10);
    map.set(key, {
      date: key,
      bill_count: Number(r.bill_count),
      item_qty_sum: Math.round(Number(r.item_qty_sum) * 100) / 100,
      subtotal: Math.round(Number(r.subtotal_sum) * 100) / 100,
      convenience_fee: Math.round(Number(r.convenience_fee_sum) * 100) / 100,
      total: Math.round(Number(r.total_sum) * 100) / 100,
    });
  }
  return eachYmdInRange(fromYmd, toYmd).map(
    (date) =>
      map.get(date) ?? {
        date,
        bill_count: 0,
        item_qty_sum: 0,
        subtotal: 0,
        convenience_fee: 0,
        total: 0,
      },
  );
}

/** Aggregate totals from a filled day range (matches sum of daily table rows). */
export function sumFilledDayRows(rows: CollectedDayRow[]) {
  return {
    total: Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100,
    bill_count: rows.reduce((s, r) => s + r.bill_count, 0),
    item_qty_sum: Math.round(rows.reduce((s, r) => s + r.item_qty_sum, 0) * 100) / 100,
    subtotal: Math.round(rows.reduce((s, r) => s + r.subtotal, 0) * 100) / 100,
    convenience_fee: Math.round(rows.reduce((s, r) => s + r.convenience_fee, 0) * 100) / 100,
  };
}
