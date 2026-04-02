export const SERVICE_FEE_SHORT_EXPLANATION =
  'Service fee helps cover LaundroSwipe’s order support, pickup coordination, tracking, notifications, and billing management. Laundry charges are set separately by the vendor.';

export const SERVICE_FEE_TERMS_EXPLANATION =
  'LaundroSwipe may charge a Service fee in addition to the laundry charges set by the vendor. This Service fee covers the digital and operational services provided by LaundroSwipe, including order scheduling, pickup coordination, order tracking, notifications, billing records, customer support, and related platform services. Vendor laundry charges remain separately determined by the vendor or applicable pricing agreement.';

export const SERVICE_FEE_TIERS = [
  { minSubtotal: 0, maxSubtotal: 49, fee: 0 },
  { minSubtotal: 50, maxSubtotal: 99, fee: 5 },
  { minSubtotal: 100, maxSubtotal: 199, fee: 10 },
  { minSubtotal: 200, maxSubtotal: Number.POSITIVE_INFINITY, fee: 20 },
] as const;

export function calculateServiceFee(subtotal: number): number {
  const safeSubtotal = Number.isFinite(subtotal) ? Math.max(0, Math.floor(subtotal)) : 0;
  const tier = SERVICE_FEE_TIERS.find(
    ({ minSubtotal, maxSubtotal }) => safeSubtotal >= minSubtotal && safeSubtotal <= maxSubtotal
  );
  return tier?.fee ?? 0;
}

export function formatServiceFeeTiers(): string {
  return '₹0–₹49: ₹0 · ₹50–₹99: ₹5 · ₹100–₹199: ₹10 · ₹200+: ₹20';
}

// Temporary vendor billing offer window.
const SERVICE_FEE_DISCOUNT_START = '2026-04-02';
const SERVICE_FEE_DISCOUNT_DAYS = 5;

export type ServiceFeeDiscount = {
  originalFee: number;
  finalFee: number;
  discount: number;
  active: boolean;
};

export function applyServiceFeeDiscount(subtotal: number, at: Date = new Date()): ServiceFeeDiscount {
  const originalFee = calculateServiceFee(subtotal);
  const startsAt = new Date(`${SERVICE_FEE_DISCOUNT_START}T00:00:00`);
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + SERVICE_FEE_DISCOUNT_DAYS);
  const active = at >= startsAt && at < endsAt;
  if (!active || originalFee <= 0) return { originalFee, finalFee: originalFee, discount: 0, active: false };
  return { originalFee, finalFee: 0, discount: originalFee, active: true };
}
