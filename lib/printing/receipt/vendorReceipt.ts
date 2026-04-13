import { formatServiceFeeReceiptLine } from '@/lib/fees';
import type { VendorBillRow } from '@/lib/api';
import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';
import {
  ESCPOSBuilder,
  PAPER_FONT_A_CHARS,
  type PaperSize,
  escposPlainDivider,
  escposPlainLineCenter,
  escposPlainLineRight,
} from '../escpos/ESCPOSBuilder';
import { sanitizeReceiptText } from '../escpos/CharacterEncodings';

export type VendorReceiptLine = { label: string; qty: number; price: number };

export type VendorReceiptInput = {
  vendorName: string;
  tokenLabel: string;
  orderLabel: string;
  customerLabel: string;
  phoneLabel: string;
  customerDisplayId: string;
  regNo?: string;
  hostelBlock?: string;
  roomNumber?: string;
  dateStr: string;
  lineItems: VendorReceiptLine[];
  totalItems: number;
  subtotal: number;
  serviceFeeLine: string;
  total: number;
  footer?: string;
  /** Optional payment QR (UPI, etc.) */
  paymentQrPayload?: string;
  showQr?: boolean;
};

function money(n: number): string {
  return `Rs.${n.toFixed(2)}`;
}

function truncateForPaper(label: string, paper: PaperSize): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const cap = Math.max(8, w - 4);
  const s = sanitizeReceiptText(label);
  if (s.length <= cap) return s;
  return `${s.slice(0, Math.max(1, cap - 1))}…`;
}

/**
 * Build raw ESC/POS bytes for a LaundroSwipe vendor bill.
 */
export function buildVendorReceiptEscPos(paper: PaperSize, input: VendorReceiptInput): Uint8Array {
  const density = getBlePrinterPreferences().printDensity;
  const b = new ESCPOSBuilder(paper);
  b.initialize().codePage(0).printDensity(density);

  b.align('center').bold(true).fontSize('doubleHeight').text('LaundroSwipe').fontSize('normal').bold(false);
  b.text(input.vendorName);
  b.divider();
  b.align('left');
  b.text(`Token: #${input.tokenLabel}  Order: ${input.orderLabel}`);
  b.text(`Customer ID: ${input.customerDisplayId}`);
  b.text(`Customer: ${input.customerLabel}`);
  b.text(`Phone: ${input.phoneLabel}`);
  if (input.regNo?.trim()) b.text(`Reg no: ${input.regNo.trim()}`);
  if (input.hostelBlock?.trim() || input.roomNumber?.trim()) {
    const parts = [
      input.hostelBlock?.trim() ? `Block ${input.hostelBlock.trim()}` : '',
      input.roomNumber?.trim() ? `Room ${input.roomNumber.trim()}` : '',
    ].filter(Boolean);
    if (parts.length) b.text(`Hostel: ${parts.join(' · ')}`);
  }
  b.text(`Date: ${input.dateStr}`);
  b.divider();

  b.bold(true).text('LINE ITEMS').bold(false);
  for (const l of input.lineItems) {
    const amt = money(l.price * l.qty);
    const descLine = `${l.qty}× ${truncateForPaper(l.label, paper)}`;
    b.align('left').fontSize('doubleHeight').text(descLine);
    b.fontSize('normal').align('right').text(`${money(l.price)} each  ${amt}`);
    b.align('left');
  }
  b.divider();

  b.text(`Total items: ${input.totalItems}`);
  b.text(`Subtotal: ${money(input.subtotal)}`);
  b.text(input.serviceFeeLine);
  b.bold(true).text(`TOTAL: ${money(input.total)}`).bold(false);

  if (input.showQr && input.paymentQrPayload?.trim()) {
    b.feed(1).align('center');
    try {
      b.qrCode(input.paymentQrPayload.trim());
    } catch {
      b.text('[QR skipped]');
    }
  }

  b.feed(1).align('center').text(input.footer ?? 'Thank you!');
  b.feed(4).cut(false);

  return b.build();
}

/**
 * Plain-text lines matching `buildVendorReceiptEscPos` (same widths as `tableRow` / `divider`).
 * Use for the browser print dialog and as the text fallback when wrapping to ESC/POS bytes.
 */
export function formatVendorReceiptEscPosPlain(paper: PaperSize, input: VendorReceiptInput): string {
  const lines: string[] = [];
  lines.push(sanitizeReceiptText('LaundroSwipe'));
  lines.push(sanitizeReceiptText(input.vendorName));
  lines.push(escposPlainDivider(paper));
  lines.push(sanitizeReceiptText(`Token: #${input.tokenLabel}  Order: ${input.orderLabel}`));
  lines.push(sanitizeReceiptText(`Customer ID: ${input.customerDisplayId}`));
  lines.push(sanitizeReceiptText(`Customer: ${input.customerLabel}`));
  lines.push(sanitizeReceiptText(`Phone: ${input.phoneLabel}`));
  if (input.regNo?.trim()) lines.push(sanitizeReceiptText(`Reg no: ${input.regNo.trim()}`));
  if (input.hostelBlock?.trim() || input.roomNumber?.trim()) {
    const parts = [
      input.hostelBlock?.trim() ? `Block ${input.hostelBlock.trim()}` : '',
      input.roomNumber?.trim() ? `Room ${input.roomNumber.trim()}` : '',
    ].filter(Boolean);
    if (parts.length) lines.push(sanitizeReceiptText(`Hostel: ${parts.join(' · ')}`));
  }
  lines.push(sanitizeReceiptText(`Date: ${input.dateStr}`));
  lines.push(escposPlainDivider(paper));
  lines.push(sanitizeReceiptText('LINE ITEMS'));
  for (const l of input.lineItems) {
    const amt = money(l.price * l.qty);
    const descLine = `${l.qty}× ${truncateForPaper(l.label, paper)}`;
    lines.push(sanitizeReceiptText(descLine));
    lines.push(escposPlainLineRight(paper, sanitizeReceiptText(`${money(l.price)} each  ${amt}`)));
  }
  lines.push(escposPlainDivider(paper));
  lines.push(sanitizeReceiptText(`Total items: ${input.totalItems}`));
  lines.push(sanitizeReceiptText(`Subtotal: ${money(input.subtotal)}`));
  lines.push(sanitizeReceiptText(input.serviceFeeLine));
  lines.push(sanitizeReceiptText(`TOTAL: ${money(input.total)}`));
  if (input.showQr && input.paymentQrPayload?.trim()) {
    lines.push('');
    const q = input.paymentQrPayload.trim();
    lines.push(sanitizeReceiptText(q.length > 90 ? `[QR on paper] ${q.slice(0, 87)}…` : `[QR on paper] ${q}`));
  }
  lines.push('');
  lines.push(escposPlainLineCenter(paper, sanitizeReceiptText(input.footer ?? 'Thank you!')));
  return lines.join('\n');
}

/** Same `VendorReceiptInput` shape as `buildVendorReceiptEscPos` uses for saved bills (no payment QR). */
export function savedVendorBillToReceiptInput(b: VendorBillRow): VendorReceiptInput {
  const totalItems = Array.isArray(b.line_items)
    ? b.line_items.reduce((s, l) => s + Number(l.qty || 0), 0)
    : 0;
  const serviceFeeLine = formatServiceFeeReceiptLine(
    Number(b.subtotal ?? 0),
    Number(b.convenience_fee ?? 0),
    'rs',
  );
  return {
    vendorName: b.vendor_name ?? 'LaundroSwipe',
    tokenLabel: b.order_token,
    orderLabel: b.order_number ?? '—',
    customerLabel: b.customer_name ?? '—',
    phoneLabel: b.customer_phone ?? '—',
    customerDisplayId: b.user_display_id ?? '—',
    regNo: b.customer_reg_no ?? undefined,
    hostelBlock: b.customer_hostel_block ?? undefined,
    roomNumber: b.customer_room_number ?? undefined,
    dateStr: b.created_at ? new Date(b.created_at).toLocaleString() : new Date().toLocaleString(),
    lineItems: Array.isArray(b.line_items)
      ? b.line_items.map((l) => ({ label: l.label, qty: l.qty, price: l.price }))
      : [],
    totalItems,
    subtotal: Number(b.subtotal ?? 0),
    serviceFeeLine,
    total: Number(b.total ?? 0),
    footer: 'Thank you!',
  };
}
