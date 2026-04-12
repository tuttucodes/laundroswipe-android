import { calculateServiceFee } from '@/lib/fees';
import type { VendorBillRow } from '@/lib/api';
import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';
import {
  ESCPOSBuilder,
  type PaperSize,
  PAPER_FONT_A_CHARS,
  escposPlainDivider,
  escposPlainLineCenterPreview,
  escposPlainTableRowPreview,
  escposPlainTwoColumnPreview,
  escposTableColumnWidths,
} from '../escpos/ESCPOSBuilder';
import { sanitizeReceiptText, sanitizeReceiptTextForPreview } from '../escpos/CharacterEncodings';

export type VendorReceiptLine = { label: string; qty: number; price: number; id?: string };

export type VendorReceiptInput = {
  /** Centered title (e.g. LaundroSwipe). */
  vendorName: string;
  /** Optional centered subtitle under the title (e.g. Pro Fab Power Laundry Services). */
  tagline?: string;
  tokenLabel: string;
  orderLabel: string;
  customerLabel: string;
  phoneLabel: string;
  customerDisplayId: string;
  /** Shown as Email: … when set. */
  customerEmail?: string;
  regNo?: string;
  hostelBlock?: string;
  roomNumber?: string;
  dateStr: string;
  lineItems: VendorReceiptLine[];
  totalItems: number;
  subtotal: number;
  /** Convenience / platform fee actually charged. */
  convenienceFee: number;
  /** When greater than `convenienceFee`, receipt shows a two-line fee + discount block (reference layout). */
  convenienceFeeOriginal?: number;
  total: number;
  footer?: string;
  paymentQrPayload?: string;
  showQr?: boolean;
  /** Optional extra centered lines under tagline (GSTIN, address, …). */
  taxRegLabel?: string;
  addressLines?: string[];
};

function money(n: number): string {
  return `₹${n.toFixed(2)}`;
}

/** Extra blank lines before cut. */
const RECEIPT_TRAILING_FEED_LINES = 10;

/** Word-wrap for the description column only (qty | desc | amt). */
function wrapToMidWidth(label: string, mw: number, prep: (s: string) => string): string[] {
  const safe = prep(label);
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
    if (next.length <= mw) {
      cur = next;
      continue;
    }
    flush();
    if (w.length <= mw) {
      cur = w;
    } else {
      let rest = w;
      while (rest.length > 0) {
        if (rest.length <= mw) {
          chunks.push(rest);
          rest = '';
        } else {
          chunks.push(rest.slice(0, mw));
          rest = rest.slice(mw);
        }
      }
    }
  }
  flush();
  if (!chunks.length) chunks.push(safe.slice(0, mw));
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

function printMetaLine(b: ESCPOSBuilder, label: string, value: string): void {
  const v = value.trim();
  if (!v || v === '—') return;
  b.text(sanitizeReceiptText(`${label}: ${v}`));
}

function pushServiceFeeTotalsEscPos(b: ESCPOSBuilder, charged: number, original?: number): void {
  const showSplit = original !== undefined && original > charged;
  if (showSplit) {
    b.twoColumn('Service fee (7-day', money(original!));
    b.twoColumn('discount)', money(charged));
  } else {
    b.twoColumn('Service fee', money(charged));
  }
}

/**
 * Reference-style receipt: centered business + tagline, meta block, qty | description | amount with @unit under desc, totals, Thank you!
 */
export function buildVendorReceiptEscPos(paper: PaperSize, input: VendorReceiptInput): Uint8Array {
  const density = getBlePrinterPreferences().printDensity;
  const b = new ESCPOSBuilder(paper);
  const w = PAPER_FONT_A_CHARS[paper];
  const { lw, mw } = escposTableColumnWidths(paper);
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
  b.feed(1);
  b.align('center').bold(true).fontSize('doubleHeight').text(sanitizeReceiptText(input.vendorName)).fontSize('normal').bold(false);
  if (input.tagline?.trim()) {
    b.text(sanitizeReceiptText(input.tagline.trim()));
  }
  if (input.taxRegLabel?.trim()) b.text(sanitizeReceiptText(input.taxRegLabel.trim()));
  for (const line of input.addressLines ?? []) {
    if (line?.trim()) b.text(sanitizeReceiptText(line.trim()));
  }
  b.feed(1);

  b.align('left');
  printMetaLine(b, 'Token', tokenDisplay(input.tokenLabel));
  const orderNo = (input.orderLabel ?? '').trim() || '—';
  printMetaLine(b, 'Order', orderNo);
  printMetaLine(b, 'Customer', input.customerLabel);
  printMetaLine(b, 'Phone', input.phoneLabel);
  printMetaLine(b, 'Customer ID', input.customerDisplayId);
  printMetaLine(b, 'Email', input.customerEmail ?? '');
  printMetaLine(b, 'Date', input.dateStr);
  if (input.regNo?.trim()) printMetaLine(b, 'Reg no', input.regNo.trim());
  if (input.hostelBlock?.trim()) printMetaLine(b, 'Block', input.hostelBlock.trim());
  if (input.roomNumber?.trim()) printMetaLine(b, 'Room', input.roomNumber.trim());

  b.feed(1);
  b.divider('-');
  b.bold(true).tableRow('Qty', 'Description', 'Amount').bold(false);

  const prep = sanitizeReceiptText;
  for (const l of input.lineItems) {
    const descLines = wrapToMidWidth(l.label, mw, prep);
    const first = descLines[0] ?? '';
    const lineTotal = l.qty * l.price;
    b.tableRow(String(l.qty), first, money(lineTotal));
    for (let i = 1; i < descLines.length; i += 1) {
      b.text(' '.repeat(lw) + descLines[i].slice(0, mw));
    }
    if (l.id?.trim()) {
      b.text(' '.repeat(lw) + prep(l.id.trim()).slice(0, mw));
    }
    const unitIndent = ' '.repeat(lw) + ' ';
    b.text((unitIndent + `@${money(l.price)}`).slice(0, w));
    b.feed(1);
  }

  b.divider('-');
  b.feed(1);
  b.twoColumn(sanitizeReceiptText('Total items'), sanitizeReceiptText(String(input.totalItems)));
  b.twoColumn(sanitizeReceiptText('Subtotal'), sanitizeReceiptText(money(input.subtotal)));
  pushServiceFeeTotalsEscPos(b, input.convenienceFee, input.convenienceFeeOriginal);

  b.divider('-');
  b.feed(1);
  const totalLine = totalLinePadded(paper, 'Total', money(input.total), prep);
  b.align('left').bold(true).fontSize('doubleHeight').text(totalLine).fontSize('normal').bold(false);
  b.feed(1);

  b.align('center').text(sanitizeReceiptText('Thank you!'));
  if (input.footer?.trim()) {
    b.feed(1);
    b.text(sanitizeReceiptText(input.footer.trim()));
  }
  b.feed(RECEIPT_TRAILING_FEED_LINES).cut(false);

  return b.build();
}

export function formatVendorReceiptEscPosPlain(paper: PaperSize, input: VendorReceiptInput): string {
  const lines: string[] = [];
  const w = PAPER_FONT_A_CHARS[paper];
  const { lw, mw } = escposTableColumnWidths(paper);
  const prep = sanitizeReceiptTextForPreview;

  if (input.showQr && input.paymentQrPayload?.trim()) {
    const q = input.paymentQrPayload.trim();
    lines.push(prep(q.length > 90 ? `[QR] ${q.slice(0, 87)}…` : `[QR] ${q}`));
    lines.push('');
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push('');
  lines.push(escposPlainLineCenterPreview(paper, prep(input.vendorName)));
  if (input.tagline?.trim()) lines.push(escposPlainLineCenterPreview(paper, prep(input.tagline.trim())));
  if (input.taxRegLabel?.trim()) lines.push(escposPlainLineCenterPreview(paper, prep(input.taxRegLabel.trim())));
  for (const line of input.addressLines ?? []) {
    if (line?.trim()) lines.push(escposPlainLineCenterPreview(paper, prep(line.trim())));
  }
  lines.push('');

  const pushMeta = (label: string, value: string) => {
    const v = value.trim();
    if (!v || v === '—') return;
    lines.push(prep(`${label}: ${v}`));
  };
  pushMeta('Token', tokenDisplay(input.tokenLabel));
  pushMeta('Order', (input.orderLabel ?? '').trim() || '—');
  pushMeta('Customer', input.customerLabel);
  pushMeta('Phone', input.phoneLabel);
  pushMeta('Customer ID', input.customerDisplayId);
  if (input.customerEmail?.trim()) pushMeta('Email', input.customerEmail.trim());
  pushMeta('Date', input.dateStr);
  if (input.regNo?.trim()) pushMeta('Reg no', input.regNo.trim());
  if (input.hostelBlock?.trim()) pushMeta('Block', input.hostelBlock.trim());
  if (input.roomNumber?.trim()) pushMeta('Room', input.roomNumber.trim());

  lines.push('');
  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainTableRowPreview(paper, 'Qty', 'Description', 'Amount'));

  for (const l of input.lineItems) {
    const descLines = wrapToMidWidth(l.label, mw, prep);
    const first = descLines[0] ?? '';
    lines.push(escposPlainTableRowPreview(paper, String(l.qty), first, money(l.qty * l.price)));
    for (let i = 1; i < descLines.length; i += 1) {
      lines.push(' '.repeat(lw) + prep(descLines[i]).slice(0, mw));
    }
    if (l.id?.trim()) {
      lines.push(' '.repeat(lw) + prep(l.id.trim()).slice(0, mw));
    }
    const unitIndent = ' '.repeat(lw) + ' ';
    lines.push((unitIndent + `@${money(l.price)}`).slice(0, w));
    lines.push('');
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push('');
  lines.push(escposPlainTwoColumnPreview(paper, 'Total items', String(input.totalItems)));
  lines.push(escposPlainTwoColumnPreview(paper, 'Subtotal', money(input.subtotal)));
  const showSplit =
    input.convenienceFeeOriginal !== undefined && input.convenienceFeeOriginal > input.convenienceFee;
  if (showSplit) {
    lines.push(escposPlainTwoColumnPreview(paper, 'Service fee (7-day', money(input.convenienceFeeOriginal!)));
    lines.push(escposPlainTwoColumnPreview(paper, 'discount)', money(input.convenienceFee)));
  } else {
    lines.push(escposPlainTwoColumnPreview(paper, 'Service fee', money(input.convenienceFee)));
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push('');
  lines.push(escposPlainTwoColumnPreview(paper, 'Total', money(input.total)));
  lines.push('');
  lines.push(escposPlainLineCenterPreview(paper, 'Thank you!'));
  if (input.footer?.trim()) {
    lines.push('');
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
    vendorName: b.vendor_name ?? 'LaundroSwipe',
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
