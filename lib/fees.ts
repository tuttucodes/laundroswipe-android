export const SERVICE_FEE_SHORT_EXPLANATION =
  'Service fee covers LaundroSwipe order support, pickup coordination, tracking, notifications, and billing. Laundry charges are set separately by the vendor.';

export const SERVICE_FEE_TERMS_EXPLANATION =
  'LaundroSwipe may charge a Service fee in addition to the laundry charges set by the vendor. This Service fee covers the digital and operational services provided by LaundroSwipe, including order scheduling, pickup coordination, order tracking, notifications, billing records, customer support, and related platform services. Vendor laundry charges remain separately determined by the vendor or applicable pricing agreement.';

export const SERVICE_FEE_TIERS = [
  { minSubtotal: 0, maxSubtotal: 49, fee: 0 },
  { minSubtotal: 50, maxSubtotal: 99, fee: 5 },
  { minSubtotal: 100, maxSubtotal: 199, fee: 10 },
  { minSubtotal: 200, maxSubtotal: Number.POSITIVE_INFINITY, fee: 20 },
] as const;

export function calculateServiceFee(subtotal: number): number {
  const safe = Number.isFinite(subtotal) ? Math.max(0, Math.floor(subtotal)) : 0;
  const tier = SERVICE_FEE_TIERS.find(
    ({ minSubtotal, maxSubtotal }) => safe >= minSubtotal && safe <= maxSubtotal,
  );
  return tier?.fee ?? 0;
}

export function formatServiceFeeTiers(): string {
  return '₹0–₹49: ₹0 · ₹50–₹99: ₹5 · ₹100–₹199: ₹10 · ₹200+: ₹20';
}

export const SERVICE_FEE_DISCOUNT_LABEL = '(14 Day Discount)';

export type ServiceFeeDiscount = {
  originalFee: number;
  finalFee: number;
  discount: number;
  active: boolean;
};

export function applyServiceFeeDiscount(subtotal: number): ServiceFeeDiscount {
  const originalFee = calculateServiceFee(subtotal);
  if (originalFee <= 0) return { originalFee, finalFee: 0, discount: 0, active: false };
  return { originalFee, finalFee: 0, discount: originalFee, active: true };
}

export type ServiceFeeReceiptCurrency = 'rs' | 'inr';

export function formatServiceFeeReceiptLine(
  subtotal: number,
  convenienceFeeCharged: number,
  currency: ServiceFeeReceiptCurrency = 'rs',
): string {
  const sym = currency === 'inr' ? '₹' : 'Rs.';
  const original = calculateServiceFee(subtotal);
  const fee = Math.round(Number(convenienceFeeCharged) * 100) / 100;

  if (fee === 0 && original > 0) {
    return `Service fee: ${sym}${original.toFixed(2)} | ${SERVICE_FEE_DISCOUNT_LABEL}: -${sym}${original.toFixed(2)} | Payable: ${sym}0`;
  }
  if (fee === 0) {
    return `Service fee: ${sym}0`;
  }
  return `Service fee: ${sym}${fee.toFixed(2)}`;
}
