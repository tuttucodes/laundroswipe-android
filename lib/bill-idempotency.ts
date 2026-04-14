import { createHash } from 'crypto';

type LineItemFingerprintInput = {
  id: string;
  qty: number;
  price: number;
};

export function stableLineItemsFingerprint(items: LineItemFingerprintInput[]): string {
  const canon = [...items]
    .map((x) => ({
      id: String(x.id),
      qty: Math.max(1, Math.floor(Number(x.qty) || 0)),
      price: Number(Number(x.price || 0).toFixed(2)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((x) => `${x.id}:${x.qty}:${x.price.toFixed(2)}`)
    .join('|');
  return canon;
}

export function makeBillIdempotencyKey(parts: {
  vendorScope: string;
  operation: string;
  token: string;
  lineItemsFingerprint: string;
}): string {
  const payload = `${parts.vendorScope}|${parts.operation}|${parts.token}|${parts.lineItemsFingerprint}`;
  return createHash('sha256').update(payload).digest('hex');
}

