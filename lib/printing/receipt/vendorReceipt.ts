import { calculateServiceFee } from '@/lib/fees';
import type { VendorBillRow } from '@/lib/api';
import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';
import {
  ESCPOSBuilder,
  type PaperSize,
  PAPER_FONT_A_CHARS,
  escposPlainDivider,
  escposPlainInvoiceRow5ContPreview,
  escposPlainInvoiceRow5Preview,
  escposPlainLineCenterPreview,
  escposPlainTwoColumnPreview,
  escposInvoiceColumnWidths,
} from '../escpos/ESCPOSBuilder';
import { sanitizeReceiptText, sanitizeReceiptTextForPreview } from '../escpos/CharacterEncodings';

export type VendorReceiptLine = { label: string; qty: number; price: number; id?: string };

export type VendorReceiptInput = {
  /** Shown centered under the LaundroSwipe brand (e.g. Profab). */
  vendorName: string;
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
  dateStr: string;
  lineItems: VendorReceiptLine[];
  totalItems: number;
  subtotal: number;
  convenienceFee: number;
  convenienceFeeOriginal?: number;
  total: number;
  footer?: string;
  paymentQrPayload?: string;
  showQr?: boolean;
  taxRegLabel?: string;
  addressLines?: string[];
};

const RECEIPT_BRAND = 'LaundroSwipe';
const DOC_TITLE = 'BILL';
const THANK_YOU = 'Thank you!';
const VISIT_LINE = 'Thanks for your visit';

/** Rupee amounts on bills (ASCII-friendly for thermal). */
export function rsMoney(n: number): string {
  const x = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(x)) return 'Rs.0.00';
  return `Rs.${x.toFixed(2)}`;
}

/** Blank lines before cut — keep small to save paper on 78mm rolls. */
const RECEIPT_TRAILING_FEED_LINES = 4;

function splitDateTime(dateStr: string): { datePart: string; timePart: string } {
  const s = dateStr.trim();
  const i = s.indexOf(',');
  if (i >= 0) {
    return { datePart: s.slice(0, i).trim(), timePart: s.slice(i + 1).trim() };
  }
  const m = s.match(/^(.+?)[T\s](.+)$/);
  if (m) return { datePart: m[1].trim(), timePart: m[2].trim() };
  return { datePart: s, timePart: '' };
}

/** Word-wrap for the invoice description column only. */
function wrapToDescWidth(text: string, d: number, prep: (s: string) => string): string[] {
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
    if (next.length <= d) {
      cur = next;
      continue;
    }
    flush();
    if (w.length <= d) {
      cur = w;
    } else {
      let rest = w;
      while (rest.length > 0) {
        if (rest.length <= d) {
          chunks.push(rest);
          rest = '';
        } else {
          chunks.push(rest.slice(0, d));
          rest = rest.slice(d);
        }
      }
    }
  }
  flush();
  if (!chunks.length) chunks.push(safe.slice(0, d));
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

function clipLine(b: ESCPOSBuilder, line: string): void {
  const w = PAPER_FONT_A_CHARS[b.getPaperSize()];
  const t = sanitizeReceiptText(line);
  b.text(t.length <= w ? t : `${t.slice(0, w - 1)}…`);
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

function plainItemDescForPreview(label: string, prep: (s: string) => string): string {
  return prep(label).toUpperCase();
}

/**
 * Thermal invoice layout: section rules, five-column lines, compact spacing (78mm / 46 chars).
 */
export function buildVendorReceiptEscPos(paper: PaperSize, input: VendorReceiptInput): Uint8Array {
  const density = getBlePrinterPreferences().printDensity;
  const b = new ESCPOSBuilder(paper);
  const prep = sanitizeReceiptText;
  const w = PAPER_FONT_A_CHARS[paper];
  const { d } = escposInvoiceColumnWidths(paper);
  b.initialize().codePage(0).printDensity(density);

  if (input.showQr && input.paymentQrPayload?.trim()) {
    b.align('center');
    try {
      b.qrCode(input.paymentQrPayload.trim());
    } catch {
      b.text('[QR skipped]');
    }
    b.align('left');
  }

  b.divider('-');
  b.align('center').text(sanitizeReceiptText(DOC_TITLE));
  b.align('center').bold(true).fontSize('doubleHeight').text(sanitizeReceiptText(RECEIPT_BRAND)).fontSize('normal').bold(false);
  b.align('center').bold(true).text(sanitizeReceiptText(input.vendorName.trim() || 'Vendor')).bold(false);
  if (input.taxRegLabel?.trim()) {
    b.align('center').text(sanitizeReceiptText(input.taxRegLabel.trim()));
  }
  if (input.addressLines?.length) {
    for (const raw of input.addressLines) {
      const al = raw.trim();
      if (al) b.align('center').text(sanitizeReceiptText(al.slice(0, w)));
    }
  }
  b.divider('-');

  const orderNo = (input.orderLabel ?? '').trim() || '—';
  const { datePart, timePart } = splitDateTime(input.dateStr);
  b.align('left');
  b.twoColumn(sanitizeReceiptText(`Order: ${orderNo}`), sanitizeReceiptText(datePart));
  b.twoColumn(sanitizeReceiptText(`Token: ${tokenDisplay(input.tokenLabel)}`), sanitizeReceiptText(timePart || ' '));

  b.divider('-');
  b.text(sanitizeReceiptText('To,'));
  clipLine(b, input.customerLabel);
  clipLine(b, `Phone: ${input.phoneLabel}`);
  if (input.regNo?.trim()) clipLine(b, `Reg: ${input.regNo.trim()}`);
  if (input.hostelBlock?.trim()) clipLine(b, `Block: ${input.hostelBlock.trim()}`);
  if (input.roomNumber?.trim()) clipLine(b, `Room: ${input.roomNumber.trim()}`);

  b.divider('-');
  b.invoiceHeaderRow5('No', 'Item', 'Qty', 'Rate', 'Amt');
  b.divider('-');

  for (let i = 0; i < input.lineItems.length; i += 1) {
    const l = input.lineItems[i];
    const sr = String(i + 1);
    const descLines = wrapToDescWidth(l.label, d, prep);
    const first = descLines[0] ?? '';
    const lineTotal = rsMoney(l.qty * l.price);
    b.invoiceRow5BoldDesc(sr, first, String(l.qty), rsMoney(l.price), lineTotal);
    for (let j = 1; j < descLines.length; j += 1) {
      b.invoiceRow5ContinuationBold(descLines[j]);
    }
  }

  b.divider('-');
  b.twoColumn(sanitizeReceiptText('Total qty'), sanitizeReceiptText(String(input.totalItems)));
  b.twoColumn(sanitizeReceiptText('Subtotal'), sanitizeReceiptText(rsMoney(input.subtotal)));
  pushServiceFeeTotalsEscPos(b, input.convenienceFee, input.convenienceFeeOriginal);

  b.divider('=');
  const totalLine = totalLinePadded(paper, 'TOTAL', rsMoney(input.total), prep);
  b.align('left').bold(true).fontSize('doubleHeight').text(totalLine).fontSize('normal').bold(false);
  b.divider('=');

  b.align('center').text(sanitizeReceiptText(THANK_YOU));
  b.align('center').text(sanitizeReceiptText(VISIT_LINE));
  if (input.footer?.trim()) {
    b.align('center').text(sanitizeReceiptText(input.footer.trim()));
  }
  b.feed(RECEIPT_TRAILING_FEED_LINES).cut(false);

  return b.build();
}

export function formatVendorReceiptEscPosPlain(paper: PaperSize, input: VendorReceiptInput): string {
  const lines: string[] = [];
  const { d } = escposInvoiceColumnWidths(paper);
  const prep = sanitizeReceiptTextForPreview;
  const w = PAPER_FONT_A_CHARS[paper];

  if (input.showQr && input.paymentQrPayload?.trim()) {
    const q = input.paymentQrPayload.trim();
    lines.push(prep(q.length > 90 ? `[QR] ${q.slice(0, 87)}…` : `[QR] ${q}`));
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainLineCenterPreview(paper, prep(DOC_TITLE)));
  lines.push(escposPlainLineCenterPreview(paper, prep(RECEIPT_BRAND)));
  lines.push(escposPlainLineCenterPreview(paper, prep(input.vendorName.trim() || 'Vendor')));
  if (input.taxRegLabel?.trim()) {
    lines.push(escposPlainLineCenterPreview(paper, prep(input.taxRegLabel.trim())));
  }
  if (input.addressLines?.length) {
    for (const raw of input.addressLines) {
      const al = raw.trim();
      if (al) lines.push(escposPlainLineCenterPreview(paper, prep(al.slice(0, w))));
    }
  }
  lines.push(escposPlainDivider(paper, '-'));

  const orderNo = (input.orderLabel ?? '').trim() || '—';
  const { datePart, timePart } = splitDateTime(input.dateStr);
  lines.push(escposPlainTwoColumnPreview(paper, prep(`Order: ${orderNo}`), prep(datePart)));
  lines.push(escposPlainTwoColumnPreview(paper, prep(`Token: ${tokenDisplay(input.tokenLabel)}`), prep(timePart || ' ')));

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(prep('To,'));
  lines.push(prep(input.customerLabel).slice(0, w));
  lines.push(prep(`Phone: ${input.phoneLabel}`).slice(0, w));
  if (input.regNo?.trim()) lines.push(prep(`Reg: ${input.regNo.trim()}`).slice(0, w));
  if (input.hostelBlock?.trim()) lines.push(prep(`Block: ${input.hostelBlock.trim()}`).slice(0, w));
  if (input.roomNumber?.trim()) lines.push(prep(`Room: ${input.roomNumber.trim()}`).slice(0, w));

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainInvoiceRow5Preview(paper, 'No', 'Item', 'Qty', 'Rate', 'Amt'));
  lines.push(escposPlainDivider(paper, '-'));

  for (let i = 0; i < input.lineItems.length; i += 1) {
    const l = input.lineItems[i];
    const sr = String(i + 1);
    const descLines = wrapToDescWidth(plainItemDescForPreview(l.label, prep), d, (s) => s);
    const first = descLines[0] ?? '';
    lines.push(
      escposPlainInvoiceRow5Preview(paper, sr, first, String(l.qty), rsMoney(l.price), rsMoney(l.qty * l.price)),
    );
    for (let j = 1; j < descLines.length; j += 1) {
      lines.push(escposPlainInvoiceRow5ContPreview(paper, descLines[j]));
    }
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainTwoColumnPreview(paper, 'Total qty', String(input.totalItems)));
  lines.push(escposPlainTwoColumnPreview(paper, 'Subtotal', rsMoney(input.subtotal)));
  pushServiceFeePlain(lines, paper, input.convenienceFee, input.convenienceFeeOriginal);

  lines.push(escposPlainDivider(paper, '='));
  lines.push(totalLinePadded(paper, 'TOTAL', rsMoney(input.total), prep));
  lines.push(escposPlainDivider(paper, '='));

  lines.push(escposPlainLineCenterPreview(paper, prep(THANK_YOU)));
  lines.push(escposPlainLineCenterPreview(paper, prep(VISIT_LINE)));
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

  return {
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
    subtotal,
    convenienceFee,
    convenienceFeeOriginal,
    total: Number(b.total ?? 0),
    footer: '',
  };
}
