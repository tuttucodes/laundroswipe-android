/**
 * Thermal printers often lack UTF-8. Prefer ASCII + "Rs." for rupee.
 */

const RE_RUPEE = /₹/g;

export function sanitizeReceiptText(input: string): string {
  let s = input.replace(RE_RUPEE, 'Rs.');
  // Strip other non-ASCII that often garble on CP437
  s = s.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, (ch) => {
    if (ch === '’' || ch === "'") return "'";
    if (ch === '“' || ch === '”' || ch === '"') return '"';
    if (ch === '–' || ch === '—') return '-';
    return '';
  });
  return s;
}

export function encodeAsciiLines(text: string): Uint8Array {
  const safe = sanitizeReceiptText(text);
  const enc = new TextEncoder();
  return enc.encode(safe);
}
