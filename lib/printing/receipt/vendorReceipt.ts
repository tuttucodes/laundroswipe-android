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

/** Word-wrap for receipt lines (thermal width). */
function wrapReceiptText(line: string, maxLen: number): string[] {
  const s = sanitizeReceiptText(line);
  if (s.length <= maxLen) return [s];
  const words = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxLen) {
      cur = next;
      continue;
    }
    if (cur) out.push(cur);
    if (w.length > maxLen) {
      let rest = w;
      while (rest.length > maxLen) {
        out.push(rest.slice(0, maxLen));
        rest = rest.slice(maxLen);
      }
      cur = rest;
    } else {
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

type UnitTotalLayout =
  | { mode: 'single'; line: string }
  | { mode: 'two'; unitLine: string; totalLine: string };

/** Left `@ unit` + right line total on one row, or two rows if it does not fit. */
function layoutUnitAndTotal(paper: PaperSize, unitStr: string, lineTotal: string): UnitTotalLayout {
  const w = PAPER_FONT_A_CHARS[paper];
  if (unitStr.length + lineTotal.length + 1 <= w) {
    const pad = Math.max(1, w - unitStr.length - lineTotal.length);
    return { mode: 'single', line: unitStr + ' '.repeat(pad) + lineTotal };
  }
  return { mode: 'two', unitLine: unitStr, totalLine: escposPlainLineRight(paper, lineTotal) };
}

/**
 * Build raw ESC/POS bytes for a LaundroSwipe vendor bill.
 * Printers use built-in bitmap fonts (not Arial); we use bold + double height for line items.
 */
export function buildVendorReceiptEscPos(paper: PaperSize, input: VendorReceiptInput): Uint8Array {
  const density = getBlePrinterPreferences().printDensity;
  const w = PAPER_FONT_A_CHARS[paper];
  const b = new ESCPOSBuilder(paper);
  b.initialize().codePage(0).printDensity(density);

  b.align('center').bold(true).fontSize('doubleHeight').text('LaundroSwipe').fontSize('normal').bold(false);
  b.text(input.vendorName);
  b.divider();
  b.align('left');
  b.bold(true).fontSize('normal').text(`Token: #${input.tokenLabel}`);
  b.bold(true).text(`Customer ID: ${input.customerDisplayId}`).bold(false);
  b.text(`Order: ${input.orderLabel}`);
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
    const unitLeft = `@ ${money(l.price)} each`;
    b.align('left').bold(true).fontSize('doubleHeight').text(descLine);
    b.fontSize('normal').bold(true);
    const ut = layoutUnitAndTotal(paper, unitLeft, amt);
    if (ut.mode === 'single') {
      b.align('left').text(ut.line);
    } else {
      b.align('left').text(ut.unitLine);
      b.align('right').text(amt);
    }
    b.align('left').bold(false);
  }
  b.divider();

  b.text(`Total items: ${input.totalItems}`);
  b.text(`Subtotal: ${money(input.subtotal)}`);
  for (const sf of wrapReceiptText(input.serviceFeeLine, w)) {
    b.text(sf);
  }
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
  const w = PAPER_FONT_A_CHARS[paper];
  lines.push(sanitizeReceiptText('LaundroSwipe'));
  lines.push(sanitizeReceiptText(input.vendorName));
  lines.push(escposPlainDivider(paper));
  lines.push(sanitizeReceiptText(`Token: #${input.tokenLabel}`));
  lines.push(sanitizeReceiptText(`Customer ID: ${input.customerDisplayId}`));
  lines.push(sanitizeReceiptText(`Order: ${input.orderLabel}`));
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
    const unitLeft = `@ ${money(l.price)} each`;
    lines.push(sanitizeReceiptText(descLine));
    const ut = layoutUnitAndTotal(paper, unitLeft, amt);
    if (ut.mode === 'single') {
      lines.push(sanitizeReceiptText(ut.line));
    } else {
      lines.push(sanitizeReceiptText(ut.unitLine));
      lines.push(sanitizeReceiptText(ut.totalLine));
    }
  }
  lines.push(escposPlainDivider(paper));
  lines.push(sanitizeReceiptText(`Total items: ${input.totalItems}`));
  lines.push(sanitizeReceiptText(`Subtotal: ${money(input.subtotal)}`));
  for (const sf of wrapReceiptText(input.serviceFeeLine, w)) {
    lines.push(sanitizeReceiptText(sf));
  }
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
