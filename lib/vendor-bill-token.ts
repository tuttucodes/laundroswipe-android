/** Align with SQL: regexp_replace(order_token, '^#+', '', 'g') + trim. */
export function stripLeadingHashesFromToken(raw: string): string {
  return String(raw ?? '').replace(/^#+/g, '').trim();
}

/** Match orders.token whether stored with or without # and with varied casing. */
export function orderLookupTokenVariants(raw: string): string[] {
  const n = stripLeadingHashesFromToken(raw).trim();
  if (!n) return [];
  const u = n.toUpperCase();
  const l = n.toLowerCase();
  return [...new Set([n, `#${n}`, u, `#${u}`, l, `#${l}`])];
}
