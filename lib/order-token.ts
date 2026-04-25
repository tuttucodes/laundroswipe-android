/**
 * Mobile-side token + order-number generator. Mirrors the format the web uses when POSTing
 * to /api/orders/create. Server stores token stripped of leading `#` via stripLeadingHashesFromToken.
 */
export function generateOrderToken(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${now}${rand}`;
}

export function generateOrderNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LS${yy}${mm}${dd}${rand}`;
}
