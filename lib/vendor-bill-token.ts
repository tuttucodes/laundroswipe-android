/**
 * Token normalization — mirrored byte-for-byte from the web app.
 * SQL equivalent: regexp_replace(order_token, '^#+', '', 'g') + trim.
 * Any drift between web + mobile + SQL causes vendor_bills row collisions.
 */
export function stripLeadingHashesFromToken(raw: string): string {
  return String(raw ?? '')
    .replace(/^#+/g, '')
    .trim();
}

/** Variants matched against orders.token whether stored with/without # and in varied casing. */
export function orderLookupTokenVariants(raw: string): string[] {
  const n = stripLeadingHashesFromToken(raw).trim();
  if (!n) return [];
  const u = n.toUpperCase();
  const l = n.toLowerCase();
  return [...new Set([n, `#${n}`, u, `#${u}`, l, `#${l}`])];
}
