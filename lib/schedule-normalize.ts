import { mergeEveSlotIdsInList } from '@/lib/schedule-slot-merge';
import { scheduleDateKey } from '@/lib/schedule-date-key';

/** Raw row from `schedule_dates` before client normalization. */
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

/**
 * Normalizes `schedule_dates` rows from Supabase (DATE / JSONB shapes) for booking + admin APIs.
 */
export function normalizeScheduleDateRowsFromDb(rows: RawDbScheduleDateRow[]): NormalizedScheduleDateRow[] {
  return rows.map((r) => {
    const raw = r.slot_ids;
    let slot_ids: string[] = [];
    let slot_ids_by_vendor: Record<string, string[]> | null = null;
    if (Array.isArray(raw)) {
      slot_ids = mergeEveSlotIdsInList(raw.filter((s): s is string => typeof s === 'string'));
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const map = raw as Record<string, unknown>;
      const byVendor: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(map)) {
        if (Array.isArray(v)) {
          byVendor[k] = mergeEveSlotIdsInList(v.filter((s): s is string => typeof s === 'string'));
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
