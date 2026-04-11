/**
 * Roll up bill snapshots into stable keys: A, D1, D2 (e.g. A-102, D2/719, D1-1424).
 * A: require non-letter after A so "AB" is not merged into A.
 * D1/D2: require non-digit after so D10 is not merged into D1.
 * "Block A" / "BLOCK-A" prefixes map to the same keys (keeps SQL RPC and UI drill-down aligned).
 */
export function normalizeHostelBlockKey(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'No block';
  const u = s.toUpperCase();
  if (/^BLOCK\s*[-:]?\s*A([^A-Za-z]|$)/.test(u)) return 'A';
  if (/^BLOCK\s*[-:]?\s*D1([^0-9]|$)/.test(u)) return 'D1';
  if (/^BLOCK\s*[-:]?\s*D2([^0-9]|$)/.test(u)) return 'D2';
  if (/^A([^A-Za-z]|$)/.test(u)) return 'A';
  if (/^D1([^0-9]|$)/.test(u)) return 'D1';
  if (/^D2([^0-9]|$)/.test(u)) return 'D2';
  return u;
}
