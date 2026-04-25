import * as Crypto from 'expo-crypto';

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

/**
 * Produces the same sha256 hex digest as the server's `makeBillIdempotencyKey`
 * so mobile preflight matches server-side dedupe keys.
 */
export async function makeBillIdempotencyKey(parts: {
  vendorScope: string;
  operation: string;
  token: string;
  lineItemsFingerprint: string;
}): Promise<string> {
  const payload = `${parts.vendorScope}|${parts.operation}|${parts.token}|${parts.lineItemsFingerprint}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}
