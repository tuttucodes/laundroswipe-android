/** Align with SQL: regexp_replace(order_token, '^#+', '', 'g') + trim. */
export function stripLeadingHashesFromToken(raw: string): string {
  return String(raw ?? '').replace(/^#+/g, '').trim();
}
