/**
 * Canonicalize legacy duplicate evening slot ids.
 * - "eve" -> "evening"
 * - "{vendor}__eve" -> "{vendor}__evening"
 */
export function mergeEveToCanonicalEveningId(id: string): string {
  const value = String(id ?? '').trim();
  if (!value) return value;
  if (value === 'eve') return 'evening';
  if (value.endsWith('__eve')) return value.replace(/__eve$/, '__evening');
  return value;
}

export function mergeEveSlotIdsInList(ids: string[]): string[] {
  return Array.from(
    new Set(ids.map(mergeEveToCanonicalEveningId).filter((id) => id.length > 0))
  );
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
 * If two slots share the same label + time window, keep one.
 * Prefer canonical id "evening" over legacy "eve".
 */
export function dedupeScheduleSlotsByTimeAndLabel<T extends DedupeSlotShape>(slots: T[]): T[] {
  const byKey = new Map<string, T>();
  const rank = (id: string) => {
    if (id === 'evening') return 0;
    if (id === 'eve') return 1;
    return 2;
  };
  for (const slot of slots) {
    const key = `${String(slot.label).trim().toLowerCase()}|${String(slot.time_from).slice(0, 8)}|${String(slot.time_to).slice(0, 8)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, slot);
      continue;
    }
    const slotRank = rank(slot.id);
    const existingRank = rank(existing.id);
    if (slotRank < existingRank) {
      byKey.set(key, slot);
      continue;
    }
    if (slotRank === existingRank && slot.sort_order < existing.sort_order) {
      byKey.set(key, slot);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)
  );
}
