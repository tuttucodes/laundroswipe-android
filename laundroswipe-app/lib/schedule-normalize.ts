import { uniqueSlotIds } from './schedule-slot-merge';
import { scheduleDateKey } from './schedule-date-key';

function slotIdJsonValueToLocal(vendorKey: string, id: string): string {
  const v = String(id ?? '').trim();
  if (!v) return v;
  const prefix = `${vendorKey}__`;
  return v.startsWith(prefix) ? v.slice(prefix.length) : v;
}

export type RawDbScheduleDateRow = {
  date: unknown;
  enabled: boolean;
  slot_ids?: unknown;
  enabled_by_vendor?: unknown;
  created_at?: string;
  updated_at?: string;
};

export type NormalizedScheduleDateRow = {
  date: string;
  enabled: boolean;
  slot_ids: string[];
  slot_ids_by_vendor?: Record<string, string[]> | null;
  enabled_by_vendor?: Record<string, boolean> | null;
  created_at?: string;
  updated_at?: string;
};

export function normalizeScheduleDateRowsFromDb(rows: RawDbScheduleDateRow[]): NormalizedScheduleDateRow[] {
  return rows.map((r) => {
    const raw = r.slot_ids;
    let slot_ids: string[] = [];
    let slot_ids_by_vendor: Record<string, string[]> | null = null;
    if (Array.isArray(raw)) {
      slot_ids = uniqueSlotIds(raw.filter((s): s is string => typeof s === 'string'));
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const map = raw as Record<string, unknown>;
      const byVendor: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(map)) {
        if (Array.isArray(v)) {
          byVendor[k] = uniqueSlotIds(
            v.filter((s): s is string => typeof s === 'string').map((sid) => slotIdJsonValueToLocal(k, sid)),
          );
        }
      }
      if (Object.keys(byVendor).length > 0) slot_ids_by_vendor = byVendor;
    }
    const dateNorm = scheduleDateKey(r.date) ?? String(r.date ?? '').trim();
    return {
      date: dateNorm,
      enabled: Boolean(r.enabled),
      slot_ids,
      slot_ids_by_vendor,
      enabled_by_vendor:
        r.enabled_by_vendor && typeof r.enabled_by_vendor === 'object'
          ? (r.enabled_by_vendor as Record<string, boolean>)
          : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
}

export function scheduleDateRowByKey<T extends { date: string }>(rows: T[], date: string): T | undefined {
  const k = scheduleDateKey(date) ?? date.trim();
  return rows.find((d) => (scheduleDateKey(d.date) ?? String(d.date).trim()) === k);
}
