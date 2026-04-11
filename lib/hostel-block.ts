/**
 * Roll up bill snapshots into stable keys: A, D1, D2 (e.g. A-102, D2/719, "Mens A", "Block D 1").
 * A: require non-letter after leading A so "AB" is not merged into A.
 * D1/D2: allow optional space/dash between D and digit; D10 stays literal.
 * "Block A" / trailing "… A" / repeated HOSTEL/BLOCK prefixes map to the same keys as SQL normalize_hostel_block_key().
 */
export function normalizeHostelBlockKey(raw: string | null | undefined): string {
  let s = String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (!s) return 'No block';

  let u = s.toUpperCase();
  u = u.replace(/\s+/g, ' ');
  u = u.replace(/^((?:HOSTEL|H\.|BLK|BLOCK|TOWER|WING)\s*[-/:]?\s*)+/i, '').trim();
  if (!u) return 'No block';

  if (/^BLOCK\s*[-:]?\s*A([^A-Z]|$)/.test(u)) return 'A';
  if (/^BLOCK\s*[-:]?\s*D\s*[- ]?\s*1([^0-9]|$)/.test(u)) return 'D1';
  if (/^BLOCK\s*[-:]?\s*D\s*[- ]?\s*2([^0-9]|$)/.test(u)) return 'D2';
  if (/^BLOCK\s*[-:]?\s*D1([^0-9]|$)/.test(u)) return 'D1';
  if (/^BLOCK\s*[-:]?\s*D2([^0-9]|$)/.test(u)) return 'D2';

  if (/^D\s*[- ]?\s*1([^0-9]|$)/.test(u)) return 'D1';
  if (/^D\s*[- ]?\s*2([^0-9]|$)/.test(u)) return 'D2';

  if (/^A([^A-Z]|$)/.test(u)) return 'A';

  if (/(^|[^A-Z0-9])A\s*$/.test(u)) return 'A';
  if (/(^|[^A-Z0-9])D\s*[- ]?\s*1\s*$/.test(u)) return 'D1';
  if (/(^|[^A-Z0-9])D\s*[- ]?\s*2\s*$/.test(u)) return 'D2';

  return u;
}
