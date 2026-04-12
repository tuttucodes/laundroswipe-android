import { calculateServiceFee } from '@/lib/fees';
import type { VendorBillRow } from '@/lib/api';
import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';
import {
  ESCPOSBuilder,
  type PaperSize,
  PAPER_FONT_A_CHARS,
  escposInvoiceLineColumnWidths,
  escposPlainDivider,
  escposPlainInvoiceDescContinuationPreview,
  escposPlainInvoiceHeaderRowPreview,
  escposPlainInvoiceItemRowPreview,
  escposPlainLineCenterPreview,
  escposPlainLineRightPreview,
  escposPlainTwoColumnPreview,
} from '../escpos/ESCPOSBuilder';
import { sanitizeReceiptText, sanitizeReceiptTextForPreview } from '../escpos/CharacterEncodings';

export type VendorReceiptLine = { label: string; qty: number; price: number; id?: string };

export type VendorReceiptInput = {
  /** Centered document title (e.g. Bill, Tax Invoice). */
  documentTitle?: string;
  /** Shown centered under the title (e.g. Profab). */
  vendorName: string;
  /** Optional vendor address / tag lines (centered). */
  addressLines?: string[];
  /** Unused on printed receipt (kept for API compatibility). */
  tagline?: string;
  tokenLabel: string;
  orderLabel: string;
  customerLabel: string;
  phoneLabel: string;
  customerDisplayId: string;
  customerEmail?: string;
  regNo?: string;
  hostelBlock?: string;
  roomNumber?: string;
  /** Fallback single-line date/time if `billDateStr` / `billTimeStr` omitted. */
  dateStr: string;
  /** e.g. 09-Jun-2020 — for Bill No. / Date row. */
  billDateStr?: string;
  /** e.g. 20:03:22 — printed right-aligned under Date. */
  billTimeStr?: string;
  lineItems: VendorReceiptLine[];
  totalItems: number;
  subtotal: number;
  convenienceFee: number;
  convenienceFeeOriginal?: number;
  total: number;
  footer?: string;
  paymentQrPayload?: string;
  showQr?: boolean;
  /** e.g. GSTIN (centered under address when set). */
  taxRegLabel?: string;
};

const RECEIPT_BRAND = 'LaundroSwipe';

/** Rupee amounts on bills (ASCII-friendly for thermal). */
export function rsMoney(n: number): string {
  const x = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(x)) return 'Rs.0.00';
  return `Rs.${x.toFixed(2)}`;
}

/** Blank lines before cut — keep small to save paper on 78mm rolls. */
const RECEIPT_TRAILING_FEED_LINES = 4;

function splitDateTimeFromLocale(dateStr: string): { datePart: string; timePart: string } {
  const i = dateStr.indexOf(',');
  if (i >= 0) {
    return { datePart: dateStr.slice(0, i).trim(), timePart: dateStr.slice(i + 1).trim() };
  }
  return { datePart: dateStr.trim(), timePart: '' };
}

function resolveBillDateTime(input: VendorReceiptInput): { dateLine: string; timeLine: string } {
  const explicitD = input.billDateStr?.trim();
  const explicitT = input.billTimeStr?.trim();
  if (explicitD && explicitT) return { dateLine: explicitD, timeLine: explicitT };
  if (explicitD && !explicitT) return { dateLine: explicitD, timeLine: '' };
  const { datePart, timePart } = splitDateTimeFromLocale(input.dateStr);
  return { dateLine: explicitD || datePart, timeLine: explicitT || timePart };
}

/** Word-wrap for invoice description column only. */
function wrapToDescWidth(text: string, dw: number, prep: (s: string) => string): string[] {
  const safe = prep(text);
  const words = safe.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur = '';
  const flush = () => {
    if (cur) {
      chunks.push(cur);
      cur = '';
    }
  };
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= dw) {
      cur = next;
      continue;
    }
    flush();
    if (w.length <= dw) {
      cur = w;
    } else {
      let rest = w;
      while (rest.length > 0) {
        if (rest.length <= dw) {
          chunks.push(rest);
          rest = '';
        } else {
          chunks.push(rest.slice(0, dw));
          rest = rest.slice(dw);
        }
      }
    }
  }
  flush();
  if (!chunks.length) chunks.push(safe.slice(0, dw));
  return chunks;
}

function totalLinePadded(paper: PaperSize, left: string, right: string, prep: (s: string) => string): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const L = prep(left);
  const R = prep(right);
  const maxL = Math.min(L.length, Math.max(4, w - 8));
  const maxR = Math.min(R.length, w - maxL - 1);
  const Ls = L.slice(0, maxL);
  const Rs = R.slice(0, maxR);
  const pad = w - Ls.length - Rs.length;
  if (pad >= 1) return Ls + ' '.repeat(pad) + Rs;
  return (Ls + ' ' + Rs).slice(0, w);
}

function tokenDisplay(token: string): string {
  const t = token.trim();
  if (!t) return '—';
  return t.startsWith('#') ? t : `#${t}`;
}

function customerAddressLine(input: VendorReceiptInput): string | null {
  const parts = [input.hostelBlock?.trim(), input.roomNumber?.trim()].filter(Boolean);
  if (!parts.length) return null;
  return parts.join(', ');
}

function pushServiceFeeTotalsEscPos(b: ESCPOSBuilder, charged: number, original?: number): void {
  if (original !== undefined && original > charged) {
    b.twoColumn('Service fee (7-day', rsMoney(original));
    b.twoColumn('discount)', rsMoney(charged));
  } else if (charged === 0) {
    b.twoColumn('Service fee (7-day discount)', rsMoney(0));
  } else {
    b.twoColumn('Service fee', rsMoney(charged));
  }
}

function pushServiceFeePlain(lines: string[], paper: PaperSize, charged: number, original?: number): void {
  const prep = sanitizeReceiptTextForPreview;
  if (original !== undefined && original > charged) {
    lines.push(escposPlainTwoColumnPreview(paper, 'Service fee (7-day', prep(rsMoney(original))));
    lines.push(escposPlainTwoColumnPreview(paper, 'discount)', prep(rsMoney(charged))));
  } else if (charged === 0) {
    lines.push(escposPlainTwoColumnPreview(paper, 'Service fee (7-day discount)', prep(rsMoney(0))));
  } else {
    lines.push(escposPlainTwoColumnPreview(paper, 'Service fee', prep(rsMoney(charged))));
  }
}

/**
 * Thermal bill: invoice-style header, Bill No./Date/Time, To/customer, Sr|Item|Qty|Rate|Amt, totals, Net amount.
 */
export function buildVendorReceiptEscPos(paper: PaperSize, input: VendorReceiptInput): Uint8Array {
  const density = getBlePrinterPreferences().printDensity;
  const b = new ESCPOSBuilder(paper);
  const prep = sanitizeReceiptText;
  const docTitle = (input.documentTitle ?? 'Bill').trim() || 'Bill';
  const { dateLine, timeLine } = resolveBillDateTime(input);
  const orderNo = (input.orderLabel ?? '').trim() || '—';

  b.initialize().codePage(0).printDensity(density);

  if (input.showQr && input.paymentQrPayload?.trim()) {
    b.align('center');
    try {
      b.qrCode(input.paymentQrPayload.trim());
    } catch {
      b.text('[QR skipped]');
    }
  }

  b.divider('-');
  b.align('center').bold(true).text(prep(docTitle)).bold(false);
  b.align('center').bold(true).text(sanitizeReceiptText(input.vendorName.trim() || 'Vendor')).bold(false);
  for (const raw of input.addressLines ?? []) {
    const line = raw.trim();
    if (line) b.align('center').text(sanitizeReceiptText(line));
  }
  if (input.taxRegLabel?.trim()) {
    b.align('center').text(sanitizeReceiptText(input.taxRegLabel.trim()));
  }
  b.align('left');
  b.divider('-');

  b.twoColumn(sanitizeReceiptText(`Bill No.: ${orderNo}`), sanitizeReceiptText(`Date: ${dateLine}`));
  if (timeLine) {
    b.align('right').text(sanitizeReceiptText(`Time: ${timeLine}`));
    b.align('left');
  }
  b.text(sanitizeReceiptText(`Token: ${tokenDisplay(input.tokenLabel)}`));
  b.divider('-');

  b.text('To,');
  b.bold(true).text(sanitizeReceiptText(input.customerLabel.trim() || '—')).bold(false);
  const addr = customerAddressLine(input);
  if (addr) b.text(sanitizeReceiptText(addr));
  const ph = input.phoneLabel.trim();
  if (ph && ph !== '—') b.text(sanitizeReceiptText(`Ph. ${ph}`));
  if (input.regNo?.trim()) b.text(sanitizeReceiptText(`Reg no: ${input.regNo.trim()}`));
  if (input.customerEmail?.trim()) b.text(sanitizeReceiptText(`Email: ${input.customerEmail.trim()}`));
  b.divider('=');

  b.invoiceTableHeader();

  const { dw } = escposInvoiceLineColumnWidths(paper);
  let sr = 1;
  for (const l of input.lineItems) {
    const descLines = wrapToDescWidth(l.label, dw, prep);
    const first = descLines[0] ?? '';
    const lineTotal = l.qty * l.price;
    b.invoiceItemRowBoldDesc(sr, first, l.qty, l.price, lineTotal);
    for (let i = 1; i < descLines.length; i += 1) {
      b.invoiceItemDescContinuationBold(descLines[i]);
    }
    sr += 1;
  }

  b.divider('-');
  b.twoColumn(sanitizeReceiptText('Total Qty'), sanitizeReceiptText(String(input.totalItems)));
  b.twoColumn(sanitizeReceiptText('Subtotal'), sanitizeReceiptText(rsMoney(input.subtotal)));
  pushServiceFeeTotalsEscPos(b, input.convenienceFee, input.convenienceFeeOriginal);

  b.divider('=');
  const netLine = totalLinePadded(paper, 'Net amount', rsMoney(input.total), prep);
  b.align('left').bold(true).fontSize('doubleHeight').text(netLine).fontSize('normal').bold(false);

  b.align('center').text(sanitizeReceiptText(`— ${RECEIPT_BRAND} —`));
  b.align('center').bold(true).text(sanitizeReceiptText('Thank you!')).bold(false);
  if (input.footer?.trim()) {
    b.align('center').text(sanitizeReceiptText(input.footer.trim()));
  }
  b.feed(RECEIPT_TRAILING_FEED_LINES).cut(false);

  return b.build();
}

function plainItemDescForPreview(label: string, prep: (s: string) => string): string {
  return prep(label).toUpperCase();
}

export function formatVendorReceiptEscPosPlain(paper: PaperSize, input: VendorReceiptInput): string {
  const lines: string[] = [];
  const prep = sanitizeReceiptTextForPreview;
  const docTitle = (input.documentTitle ?? 'Bill').trim() || 'Bill';
  const { dateLine, timeLine } = resolveBillDateTime(input);
  const orderNo = (input.orderLabel ?? '').trim() || '—';
  const { dw } = escposInvoiceLineColumnWidths(paper);

  if (input.showQr && input.paymentQrPayload?.trim()) {
    const q = input.paymentQrPayload.trim();
    lines.push(prep(q.length > 90 ? `[QR] ${q.slice(0, 87)}…` : `[QR] ${q}`));
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainLineCenterPreview(paper, prep(docTitle)));
  lines.push(escposPlainLineCenterPreview(paper, prep(input.vendorName.trim() || 'Vendor')));
  for (const raw of input.addressLines ?? []) {
    const line = raw.trim();
    if (line) lines.push(escposPlainLineCenterPreview(paper, prep(line)));
  }
  if (input.taxRegLabel?.trim()) {
    lines.push(escposPlainLineCenterPreview(paper, prep(input.taxRegLabel.trim())));
  }
  lines.push(escposPlainDivider(paper, '-'));

  lines.push(escposPlainTwoColumnPreview(paper, prep(`Bill No.: ${orderNo}`), prep(`Date: ${dateLine}`)));
  if (timeLine) {
    lines.push(escposPlainLineRightPreview(paper, prep(`Time: ${timeLine}`)));
  }
  lines.push(prep(`Token: ${tokenDisplay(input.tokenLabel)}`));
  lines.push(escposPlainDivider(paper, '-'));

  lines.push(prep('To,'));
  lines.push(prep(input.customerLabel.trim() || '—'));
  const addr = customerAddressLine(input);
  if (addr) lines.push(prep(addr));
  const ph = input.phoneLabel.trim();
  if (ph && ph !== '—') lines.push(prep(`Ph. ${ph}`));
  if (input.regNo?.trim()) lines.push(prep(`Reg no: ${input.regNo.trim()}`));
  if (input.customerEmail?.trim()) lines.push(prep(`Email: ${input.customerEmail.trim()}`));
  lines.push(escposPlainDivider(paper, '='));

  lines.push(escposPlainInvoiceHeaderRowPreview(paper));

  let sr = 1;
  for (const l of input.lineItems) {
    const descLines = wrapToDescWidth(plainItemDescForPreview(l.label, prep), dw, prep);
    const first = descLines[0] ?? '';
    lines.push(escposPlainInvoiceItemRowPreview(paper, sr, first, l.qty, l.price, l.qty * l.price));
    for (let i = 1; i < descLines.length; i += 1) {
      lines.push(escposPlainInvoiceDescContinuationPreview(paper, descLines[i]));
    }
    sr += 1;
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainTwoColumnPreview(paper, 'Total Qty', String(input.totalItems)));
  lines.push(escposPlainTwoColumnPreview(paper, 'Subtotal', rsMoney(input.subtotal)));
  pushServiceFeePlain(lines, paper, input.convenienceFee, input.convenienceFeeOriginal);

  lines.push(escposPlainDivider(paper, '='));
  lines.push(totalLinePadded(paper, 'Net amount', rsMoney(input.total), prep));

  lines.push(escposPlainLineCenterPreview(paper, prep(`— ${RECEIPT_BRAND} —`)));
  lines.push(escposPlainLineCenterPreview(paper, prep('Thank you!')));
  if (input.footer?.trim()) {
    lines.push(escposPlainLineCenterPreview(paper, prep(input.footer.trim())));
  }
  for (let i = 0; i < RECEIPT_TRAILING_FEED_LINES; i += 1) {
    lines.push('');
  }
  return lines.join('\n');
}

export function savedVendorBillToReceiptInput(b: VendorBillRow): VendorReceiptInput {
  const totalItems = Array.isArray(b.line_items)
    ? b.line_items.reduce((s, l) => s + Number(l.qty || 0), 0)
    : 0;
  const subtotal = Number(b.subtotal ?? 0);
  const convenienceFee = Number(b.convenience_fee ?? 0);
  const tierFee = calculateServiceFee(subtotal);
  const convenienceFeeOriginal = tierFee > convenienceFee ? tierFee : undefined;
  const created = b.created_at ? new Date(b.created_at) : new Date();
  const billDateStr = created.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const billTimeStr = created.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return {
    documentTitle: 'Bill',
    vendorName: b.vendor_name ?? 'Vendor',
    tagline: undefined,
    tokenLabel: b.order_token,
    orderLabel: b.order_number ?? '—',
    customerLabel: b.customer_name ?? '—',
    phoneLabel: b.customer_phone ?? '—',
    customerDisplayId: b.user_display_id ?? '—',
    customerEmail: b.user_email?.trim() || undefined,
    regNo: b.customer_reg_no ?? undefined,
    hostelBlock: b.customer_hostel_block ?? undefined,
    roomNumber: b.customer_room_number ?? undefined,
    dateStr: created.toLocaleString('en-IN'),
    billDateStr,
    billTimeStr,
    lineItems: Array.isArray(b.line_items)
      ? b.line_items.map((l) => ({
          label: l.label,
          qty: l.qty,
          price: l.price,
          id: typeof l.id === 'string' && l.id.trim() ? l.id.trim() : undefined,
        }))
      : [],
    totalItems,
    subtotal,
    convenienceFee,
    convenienceFeeOriginal,
    total: Number(b.total ?? 0),
    footer: '',
  };
}
