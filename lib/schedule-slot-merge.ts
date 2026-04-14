/** Unique non-empty slot ids, insertion order preserved for first occurrence. */
export function uniqueSlotIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

type DedupeSlotShape = {
  id: string;
  label: string;
  time_from: string;
  time_to: string;
  sort_order: number;
};

/**
 * Defensive dedupe for display/use in UI:
 * If two slots share the same label + time window, keep one (lower sort_order wins, then id).
 */
export function dedupeScheduleSlotsByTimeAndLabel<T extends DedupeSlotShape>(slots: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const slot of slots) {
    const key = `${String(slot.label).trim().toLowerCase()}|${String(slot.time_from).slice(0, 8)}|${String(slot.time_to).slice(0, 8)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, slot);
      continue;
    }
    if (slot.sort_order < existing.sort_order) {
      byKey.set(key, slot);
      continue;
    }
    if (slot.sort_order === existing.sort_order && slot.id.localeCompare(existing.id) < 0) {
      byKey.set(key, slot);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)
  );
}
