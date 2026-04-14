import type { VendorBillRow } from '@/lib/api';
import type { VendorReceiptInput } from '@/lib/printing/receipt/vendorReceipt';

export type ThermalReceiptCustomer = {
  name: string;
  phone: string;
  regNo: string;
  location: string;
};

export type ThermalReceiptLineItem = {
  name: string;
  qty: number;
  rate: number;
};

/** POS thermal receipt payload (all fields dynamic). */
export type ThermalReceiptData = {
  token: string;
  orderId: string;
  customerId: string;
  customer: ThermalReceiptCustomer;
  dateTime: string;
  items: ThermalReceiptLineItem[];
  discount: number;
  serviceFee: number;
  /** When set, TOTAL row uses this (e.g. persisted bill); else subtotal − discount + serviceFee. */
  total?: number;
  brandTitle?: string;
  subtitle?: string;
  footer?: string;
  userEmail?: string;
};

function locationFromBill(b: VendorBillRow): string {
  const blk = String(b.customer_hostel_block ?? '').trim();
  const rm = String(b.customer_room_number ?? '').trim();
  return [blk && `Block ${blk}`, rm && `Room ${rm}`].filter(Boolean).join(' · ');
}

export function vendorBillRowToThermalReceiptData(b: VendorBillRow): ThermalReceiptData {
  const items: ThermalReceiptLineItem[] = Array.isArray(b.line_items)
    ? b.line_items.map((l) => ({
        name: String(l.label ?? ''),
        qty: Math.max(0, Number(l.qty) || 0),
        rate: Number(l.price) || 0,
      }))
    : [];
  const sub = Number(b.subtotal ?? 0);
  const fee = Number(b.convenience_fee ?? 0);
  const tot = Number(b.total ?? 0);
  return {
    brandTitle: 'LAUNDROSWIPE',
    subtitle: String(b.vendor_name ?? 'LaundroSwipe').trim() || 'LaundroSwipe',
    token: String(b.order_token ?? '').replace(/^#/, ''),
    orderId: String(b.order_number ?? '—'),
    customerId: String(b.user_display_id ?? '—'),
    customer: {
      name: String(b.customer_name ?? '—'),
      phone: String(b.customer_phone ?? '—'),
      regNo: String(b.customer_reg_no ?? '').trim(),
      location: locationFromBill(b),
    },
    dateTime: b.created_at ? new Date(b.created_at).toLocaleString() : new Date().toLocaleString(),
    items,
    discount: 0,
    serviceFee: fee,
    total: tot,
    footer: 'Thank you!',
    userEmail: b.user_email != null && String(b.user_email).trim() !== '' ? String(b.user_email).trim() : undefined,
  };
}

export function vendorReceiptInputToThermalReceiptData(input: VendorReceiptInput): ThermalReceiptData {
  const items: ThermalReceiptLineItem[] = input.lineItems.map((l) => ({
    name: l.label,
    qty: l.qty,
    rate: l.price,
  }));
  const loc = [
    input.hostelBlock?.trim() ? `Block ${input.hostelBlock.trim()}` : '',
    input.roomNumber?.trim() ? `Room ${input.roomNumber.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const fee = Math.max(0, Number(input.total ?? 0) - Number(input.subtotal ?? 0));
  return {
    brandTitle: 'LAUNDROSWIPE',
    subtitle: input.vendorName?.trim() || 'LaundroSwipe',
    token: String(input.tokenLabel ?? '').replace(/^#/, ''),
    orderId: input.orderLabel || '—',
    customerId: input.customerDisplayId || '—',
    customer: {
      name: input.customerLabel || '—',
      phone: input.phoneLabel || '—',
      regNo: input.regNo?.trim() ?? '',
      location: loc,
    },
    dateTime: input.dateStr,
    items,
    discount: 0,
    serviceFee: fee,
    total: input.total,
    footer: input.footer ?? 'Thank you!',
  };
}
