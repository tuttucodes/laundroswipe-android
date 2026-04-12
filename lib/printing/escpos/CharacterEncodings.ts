/**
 * Thermal printers often lack UTF-8. Prefer ASCII + "Rs." for rupee.
 */

const RE_RUPEE = /₹/g;

/**
 * For browser print / HTML preview only — keeps Arabic and other UTF-8 readable in Arial.
 * ESC/POS thermal output should still use `sanitizeReceiptText`.
 */
export function sanitizeReceiptTextForPreview(input: string): string {
  return input
    .replace(RE_RUPEE, 'Rs.')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u200e|\u200f|\u202a-\u202e/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

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
