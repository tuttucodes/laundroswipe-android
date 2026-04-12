/**
 * Receipt text: keep ₹ (U+20B9) for thermal + preview; strip other non-ASCII that garbles CP437/legacy printers.
 */

/**
 * For browser print / HTML preview — keeps ₹, Arabic, and common punctuation readable in Arial.
 */
export function sanitizeReceiptTextForPreview(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u200e|\u200f|\u202a-\u202e/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

export function sanitizeReceiptText(input: string): string {
  let s = input;
  // Allow ₹; strip other non-ASCII that often garble on legacy code pages
  s = s.replace(/[^\x09\x0a\x0d\x20-\x7e\u20b9]/g, (ch) => {
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
