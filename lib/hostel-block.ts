/**
 * Roll up bill snapshots like "D2 - 1125", "D2/719", "D1-1424" into stable keys D2 / D1.
 * After D1/D2 we require a non-digit (or end) so D10 is not merged into D1.
 */
export function normalizeHostelBlockKey(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'No block';
  const u = s.toUpperCase();
  if (/^D1([^0-9]|$)/.test(u)) return 'D1';
  if (/^D2([^0-9]|$)/.test(u)) return 'D2';
  return u;
}
