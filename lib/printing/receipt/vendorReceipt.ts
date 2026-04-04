import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';
import { ESCPOSBuilder, type PaperSize } from '../escpos/ESCPOSBuilder';

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

  b.bold(true);
  b.tableRow('Qty', 'Description', 'Amount');
  b.bold(false);
  for (const l of input.lineItems) {
    const amt = money(l.price * l.qty);
    const desc = `${l.label} @${money(l.price)}`;
    b.tableRow(String(l.qty), desc, amt);
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
