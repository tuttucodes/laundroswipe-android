import { formatServiceFeeReceiptLine } from '@/lib/fees';
import type { VendorBillRow } from '@/lib/api';
import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';
import {
  ESCPOSBuilder,
  type PaperSize,
  PAPER_FONT_A_CHARS,
  escposPlainDivider,
  escposPlainLineCenterPreview,
  escposPlainTableRow,
  escposPlainTableRowPreview,
  escposPlainTwoColumn,
  escposPlainTwoColumnPreview,
} from '../escpos/ESCPOSBuilder';
import { sanitizeReceiptText, sanitizeReceiptTextForPreview } from '../escpos/CharacterEncodings';

export type VendorReceiptLine = { label: string; qty: number; price: number; id?: string };

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
  paymentQrPayload?: string;
  showQr?: boolean;
  /** Printed as Bill# (falls back to orderLabel). */
  billNumber?: string;
  /** Shown on the line before policy / thank-you (e.g. vendor name). */
  cashierLabel?: string;
  /** Centered above thank-you (e.g. exchange policy). */
  policyLines?: string[];
  /** Optional GSTIN / TRN line under business name. */
  taxRegLabel?: string;
  /** Extra address lines (centered), after business name. */
  addressLines?: string[];
};

function money(n: number): string {
  return `Rs.${n.toFixed(2)}`;
}

const DEFAULT_POLICY_LINES = ['Keep bill for your records.', 'Valid at issued location. T&C apply.'];

/** Wrapped item description (no serial); `lineWidth` = chars per line. */
function wrappedLabelLines(label: string, lineWidth: number, prep: (s: string) => string): string[] {
  const safe = prep(label);
  const innerW = Math.max(8, lineWidth);
  const words = safe.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= innerW) cur = next;
    else {
      if (cur) chunks.push(cur);
      if (w.length <= innerW) {
        cur = w;
      } else {
        let rest = w;
        while (rest.length > innerW) {
          chunks.push(rest.slice(0, innerW));
          rest = rest.slice(innerW);
        }
        cur = rest;
      }
    }
  }
  if (cur) chunks.push(cur);
  if (!chunks.length) chunks.push(safe.slice(0, innerW));
  return chunks;
}

/**
 * Build raw ESC/POS bytes — tax-invoice style layout (thermal-safe ASCII on hardware).
 */
export function buildVendorReceiptEscPos(paper: PaperSize, input: VendorReceiptInput): Uint8Array {
  const density = getBlePrinterPreferences().printDensity;
  const b = new ESCPOSBuilder(paper);
  const w = PAPER_FONT_A_CHARS[paper];
  b.initialize().codePage(0).printDensity(density);

  if (input.showQr && input.paymentQrPayload?.trim()) {
    b.align('center');
    try {
      b.qrCode(input.paymentQrPayload.trim());
    } catch {
      b.text('[QR skipped]');
    }
    b.feed(1);
  }

  b.divider('-');
  b.align('center').bold(true).fontSize('doubleHeight').text(sanitizeReceiptText(input.vendorName)).fontSize('normal').bold(false);
  b.text(sanitizeReceiptText('LaundroSwipe'));
  if (input.taxRegLabel?.trim()) b.text(sanitizeReceiptText(input.taxRegLabel.trim()));
  for (const line of input.addressLines ?? []) {
    if (line?.trim()) b.text(sanitizeReceiptText(line.trim()));
  }
  b.bold(true).text('TAX INVOICE').bold(false);

  b.align('left');
  const billTo =
    input.phoneLabel && input.phoneLabel !== '—'
      ? `Bill To : ${sanitizeReceiptText(input.customerLabel)} (Ph: ${sanitizeReceiptText(input.phoneLabel)})`
      : `Bill To : ${sanitizeReceiptText(input.customerLabel)}`;
  b.text(billTo);

  const billNo = sanitizeReceiptText((input.billNumber ?? input.orderLabel).trim() || '—');
  b.twoColumn(`Bill#: ${billNo}`, sanitizeReceiptText(input.dateStr));
  b.text(`Token: #${sanitizeReceiptText(input.tokenLabel)}`);
  b.text(`Customer ID: ${sanitizeReceiptText(input.customerDisplayId)}`);
  if (input.regNo?.trim()) b.text(`Reg no: ${sanitizeReceiptText(input.regNo.trim())}`);
  if (input.hostelBlock?.trim() || input.roomNumber?.trim()) {
    const parts = [
      input.hostelBlock?.trim() ? `Block ${input.hostelBlock.trim()}` : '',
      input.roomNumber?.trim() ? `Room ${input.roomNumber.trim()}` : '',
    ].filter(Boolean);
    if (parts.length) b.text(`Hostel: ${sanitizeReceiptText(parts.join(' · '))}`);
  }

  b.divider('-');
  b.bold(true).tableRow('Qty', 'Item / Rate', 'Amount').bold(false);

  for (const l of input.lineItems) {
    for (const line of wrappedLabelLines(l.label, w, sanitizeReceiptText)) {
      b.text(line);
    }
    if (l.id?.trim()) b.text(`   ${sanitizeReceiptText(l.id.trim())}`);
    b.tableRow(String(l.qty), `@${money(l.price)}`, money(l.price * l.qty));
  }

  b.divider('-');
  b.align('right');
  b.text(`Subtotal: ${money(input.subtotal)}`);
  b.text(sanitizeReceiptText(input.serviceFeeLine));
  b.bold(true).text(`Total: ${money(input.total)}`).bold(false);
  b.align('left');

  const cashier = sanitizeReceiptText((input.cashierLabel ?? input.vendorName ?? 'admin').trim() || 'admin');
  b.text(`Cashier :${cashier}`);
  b.divider('-');
  b.align('center');
  const policies = input.policyLines?.length ? input.policyLines : DEFAULT_POLICY_LINES;
  for (const p of policies) {
    if (p?.trim()) b.text(sanitizeReceiptText(p.trim()));
  }
  b.text('THANK YOU AND COME AGAIN');
  b.text(`Total items: ${input.totalItems}`);
  if (input.footer?.trim()) {
    b.feed(1);
    b.text(sanitizeReceiptText(input.footer.trim()));
  }
  b.feed(4).cut(false);

  return b.build();
}

/**
 * Plain-text mirror for browser print (Arial) and ESC/POS byte fallback — UTF-8 safe for preview.
 */
export function formatVendorReceiptEscPosPlain(paper: PaperSize, input: VendorReceiptInput): string {
  const lines: string[] = [];
  const w = PAPER_FONT_A_CHARS[paper];
  const prep = sanitizeReceiptTextForPreview;

  if (input.showQr && input.paymentQrPayload?.trim()) {
    const q = input.paymentQrPayload.trim();
    lines.push(prep(q.length > 90 ? `[QR] ${q.slice(0, 87)}…` : `[QR] ${q}`));
    lines.push('');
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainLineCenterPreview(paper, prep(input.vendorName)));
  lines.push(escposPlainLineCenterPreview(paper, prep('LaundroSwipe')));
  if (input.taxRegLabel?.trim()) lines.push(escposPlainLineCenterPreview(paper, prep(input.taxRegLabel.trim())));
  for (const line of input.addressLines ?? []) {
    if (line?.trim()) lines.push(escposPlainLineCenterPreview(paper, prep(line.trim())));
  }
  lines.push(escposPlainLineCenterPreview(paper, 'TAX INVOICE'));

  const billTo =
    input.phoneLabel && input.phoneLabel !== '—'
      ? `Bill To : ${prep(input.customerLabel)} (Ph: ${prep(input.phoneLabel)})`
      : `Bill To : ${prep(input.customerLabel)}`;
  lines.push(billTo);

  const billNo = prep((input.billNumber ?? input.orderLabel).trim() || '—');
  lines.push(escposPlainTwoColumnPreview(paper, `Bill#: ${billNo}`, prep(input.dateStr)));
  lines.push(prep(`Token: #${input.tokenLabel}`));
  lines.push(prep(`Customer ID: ${input.customerDisplayId}`));
  if (input.regNo?.trim()) lines.push(prep(`Reg no: ${input.regNo.trim()}`));
  if (input.hostelBlock?.trim() || input.roomNumber?.trim()) {
    const parts = [
      input.hostelBlock?.trim() ? `Block ${input.hostelBlock.trim()}` : '',
      input.roomNumber?.trim() ? `Room ${input.roomNumber.trim()}` : '',
    ].filter(Boolean);
    if (parts.length) lines.push(prep(`Hostel: ${parts.join(' · ')}`));
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainTableRowPreview(paper, 'Qty', 'Item / Rate', 'Amount'));

  for (const l of input.lineItems) {
    for (const dl of wrappedLabelLines(l.label, w, prep)) {
      lines.push(dl);
    }
    if (l.id?.trim()) lines.push(prep(`   ${l.id.trim()}`));
    lines.push(escposPlainTableRowPreview(paper, String(l.qty), `@${money(l.price)}`, money(l.price * l.qty)));
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainLineRightPreview(paper, `Subtotal: ${money(input.subtotal)}`));
  lines.push(escposPlainLineRightPreview(paper, prep(input.serviceFeeLine)));
  lines.push(escposPlainLineRightPreview(paper, `Total: ${money(input.total)}`));

  const cashier = prep((input.cashierLabel ?? input.vendorName ?? 'admin').trim() || 'admin');
  lines.push(`Cashier :${cashier}`);
  lines.push(escposPlainDivider(paper, '-'));
  const policies = input.policyLines?.length ? input.policyLines : DEFAULT_POLICY_LINES;
  for (const p of policies) {
    if (p?.trim()) lines.push(escposPlainLineCenterPreview(paper, prep(p.trim())));
  }
  lines.push(escposPlainLineCenterPreview(paper, 'THANK YOU AND COME AGAIN'));
  lines.push(escposPlainLineCenterPreview(paper, `Total items: ${input.totalItems}`));
  if (input.footer?.trim()) {
    lines.push('');
    lines.push(escposPlainLineCenterPreview(paper, prep(input.footer.trim())));
  }
  return lines.join('\n');
}

function escposPlainLineRightPreview(paper: PaperSize, text: string): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const t = sanitizeReceiptTextForPreview(text);
  if (t.length >= w) return t.slice(0, w);
  return t.padStart(w);
}

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
    billNumber: b.order_number ?? undefined,
    customerLabel: b.customer_name ?? '—',
    phoneLabel: b.customer_phone ?? '—',
    customerDisplayId: b.user_display_id ?? '—',
    regNo: b.customer_reg_no ?? undefined,
    hostelBlock: b.customer_hostel_block ?? undefined,
    roomNumber: b.customer_room_number ?? undefined,
    dateStr: b.created_at ? new Date(b.created_at).toLocaleString() : new Date().toLocaleString(),
    lineItems: Array.isArray(b.line_items)
      ? b.line_items.map((l) => ({
          label: l.label,
          qty: l.qty,
          price: l.price,
          id: typeof l.id === 'string' && l.id.trim() ? l.id.trim() : undefined,
        }))
      : [],
    totalItems,
    subtotal: Number(b.subtotal ?? 0),
    serviceFeeLine,
    total: Number(b.total ?? 0),
    footer: '',
    cashierLabel: (b.vendor_name ?? 'Vendor').trim() || 'admin',
    policyLines: DEFAULT_POLICY_LINES,
  };
}
