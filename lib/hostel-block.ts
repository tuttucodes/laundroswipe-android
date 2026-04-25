/**
 * Mirrors SQL normalize_hostel_block_key() so client-side rollups collapse to the same
 * keys as server-side aggregates. A/D1/D2 handled specifically; D10+ stays literal.
 */

export function displayRollupBlockKey(raw: string | null | undefined): string {
  if (raw == null) return 'No block';
  const s = String(raw)
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .trim();
  if (!s) return 'No block';
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return 'No block';
  if (lower === 'no block') return 'No block';
  return s;
}

export function normalizeHostelBlockKey(raw: string | null | undefined): string {
  let s = String(raw ?? '')
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
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

export function rollupHostelBlockKey(
  billHostelBlock: string | null | undefined,
  userHostelBlock: string | null | undefined,
): string {
  const b = String(billHostelBlock ?? '').trim();
  if (b) return normalizeHostelBlockKey(b);
  return normalizeHostelBlockKey(userHostelBlock);
}
