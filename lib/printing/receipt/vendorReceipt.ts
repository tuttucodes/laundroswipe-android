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
/** Centered document title (thermal invoice style). */
const DOC_TITLE = 'ORDER BILL';

/** Split `toLocaleString()`-style values into date / time for Bill No + Date/Time lines. */
function splitLocaleDateTime(dateStr: string): { date: string; time: string } {
  const s = dateStr.trim();
  const idx = s.indexOf(', ');
  if (idx >= 0) {
    return { date: s.slice(0, idx).trim(), time: s.slice(idx + 2).trim() };
  }
  return { date: s, time: '' };
}

/** Rupee amounts on bills (ASCII-friendly for thermal). */
export function rsMoney(n: number): string {
  const x = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(x)) return 'Rs.0.00';
  return `Rs.${x.toFixed(2)}`;
}

/** Blank lines before cut — keep small to save paper on 78mm rolls. */
const RECEIPT_TRAILING_FEED_LINES = 4;

function itemDescriptionWithRate(label: string, unitPrice: number, prep: (s: string) => string): string {
  return `${prep(label)} @${rsMoney(unitPrice)}`;
}

/** Word-wrap for the description column only (qty | desc | amt). */
function wrapToMidWidth(text: string, mw: number, prep: (s: string) => string): string[] {
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
 * Thermal invoice layout: dashed section rules, bill/date line, “To,” block, table header
 * + single rule under headers, double rule before net total — 78mm / Font A widths unchanged.
 */
export function buildVendorReceiptEscPos(paper: PaperSize, input: VendorReceiptInput): Uint8Array {
  const density = getBlePrinterPreferences().printDensity;
  const b = new ESCPOSBuilder(paper);
  const prep = sanitizeReceiptText;
  b.initialize().codePage(0).printDensity(density);

  if (input.showQr && input.paymentQrPayload?.trim()) {
    b.align('center');
    try {
      b.qrCode(input.paymentQrPayload.trim());
    } catch {
      b.text('[QR skipped]');
    }
  }

  const orderNo = (input.orderLabel ?? '').trim() || '—';
  const { date, time } = splitLocaleDateTime(input.dateStr);

  b.divider('-');
  b.align('center').bold(true).text(prep(DOC_TITLE)).bold(false);
  b.align('center').bold(true).fontSize('doubleHeight').text(prep(input.vendorName.trim() || 'Vendor')).fontSize('normal').bold(false);
  b.align('center').text(prep(RECEIPT_BRAND));
  for (const raw of input.addressLines ?? []) {
    const line = raw.trim();
    if (line) b.align('center').text(prep(line));
  }
  if (input.taxRegLabel?.trim()) {
    b.align('center').text(prep(input.taxRegLabel.trim()));
  }
  b.divider('-');

  b.align('left');
  b.twoColumn(prep(`Bill No.: ${orderNo}`), prep(`Date: ${date}`));
  if (time) {
    b.twoColumn(prep(`Token: ${tokenDisplay(input.tokenLabel)}`), prep(`Time: ${time}`));
  } else {
    printMetaLine(b, 'Token', tokenDisplay(input.tokenLabel));
  }
  b.divider('-');

  b.text(prep('To,'));
  b.bold(true).text(prep(input.customerLabel.trim() || '—')).bold(false);
  printMetaLine(b, 'Phone', input.phoneLabel);
  if (input.customerEmail?.trim()) {
    printMetaLine(b, 'Email', input.customerEmail.trim());
  }
  if (input.regNo?.trim()) printMetaLine(b, 'Reg no', input.regNo.trim());
  if (input.hostelBlock?.trim()) printMetaLine(b, 'Block', input.hostelBlock.trim());
  if (input.roomNumber?.trim()) printMetaLine(b, 'Room', input.roomNumber.trim());
  b.divider('-');

  b.bold(true).tableRow('Qty', 'Item', 'Amount').bold(false);
  b.divider('-');

  const { mw } = escposTableColumnWidths(paper);
  input.lineItems.forEach((l, idx) => {
    const descFull = `${idx + 1}. ${itemDescriptionWithRate(l.label, l.price, prep)}`;
    const descLines = wrapToMidWidth(descFull, mw, prep);
    const first = descLines[0] ?? '';
    const lineTotal = rsMoney(l.qty * l.price);
    b.tableRowBoldMid(String(l.qty), first, lineTotal);
    for (let i = 1; i < descLines.length; i += 1) {
      b.tableRowMidContinuationBold(descLines[i]);
    }
  });

  b.divider('-');
  b.twoColumn(prep('Total Qty'), prep(String(input.totalItems)));
  b.twoColumn(prep('Subtotal'), prep(rsMoney(input.subtotal)));
  pushServiceFeeTotalsEscPos(b, input.convenienceFee, input.convenienceFeeOriginal);

  b.divider('=');
  const totalLine = totalLinePadded(paper, 'Net Amount', rsMoney(input.total), prep);
  b.align('left').bold(true).fontSize('doubleHeight').text(totalLine).fontSize('normal').bold(false);

  b.divider('-');
  b.align('center').text(prep('Have a nice day'));
  b.align('center').text(prep('Thanks for your visit!'));
  if (input.footer?.trim()) {
    b.align('center').text(prep(input.footer.trim()));
  }
  b.feed(RECEIPT_TRAILING_FEED_LINES).cut(false);

  return b.build();
}

/** Plain preview: item text in ALL CAPS so descriptions stand out without ESC/POS bold. */
function plainItemDescForPreview(label: string, unitPrice: number, prep: (s: string) => string): string {
  const core = prep(label).toUpperCase();
  return `${core} @${rsMoney(unitPrice)}`;
}

export function formatVendorReceiptEscPosPlain(paper: PaperSize, input: VendorReceiptInput): string {
  const lines: string[] = [];
  const { lw, mw } = escposTableColumnWidths(paper);
  const prep = sanitizeReceiptTextForPreview;
  const orderNo = (input.orderLabel ?? '').trim() || '—';
  const { date, time } = splitLocaleDateTime(input.dateStr);

  const pushMetaPlain = (label: string, value: string) => {
    const v = value.trim();
    if (!v || v === '—') return;
    lines.push(prep(`${label}: ${v}`));
  };

  if (input.showQr && input.paymentQrPayload?.trim()) {
    const q = input.paymentQrPayload.trim();
    lines.push(prep(q.length > 90 ? `[QR] ${q.slice(0, 87)}…` : `[QR] ${q}`));
  }

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainLineCenterPreview(paper, prep(DOC_TITLE)));
  lines.push(escposPlainLineCenterPreview(paper, prep(input.vendorName.trim() || 'Vendor')));
  lines.push(escposPlainLineCenterPreview(paper, prep(RECEIPT_BRAND)));
  for (const raw of input.addressLines ?? []) {
    const line = raw.trim();
    if (line) lines.push(escposPlainLineCenterPreview(paper, prep(line)));
  }
  if (input.taxRegLabel?.trim()) {
    lines.push(escposPlainLineCenterPreview(paper, prep(input.taxRegLabel.trim())));
  }
  lines.push(escposPlainDivider(paper, '-'));

  lines.push(escposPlainTwoColumnPreview(paper, prep(`Bill No.: ${orderNo}`), prep(`Date: ${date}`)));
  if (time) {
    lines.push(escposPlainTwoColumnPreview(paper, prep(`Token: ${tokenDisplay(input.tokenLabel)}`), prep(`Time: ${time}`)));
  } else {
    pushMetaPlain('Token', tokenDisplay(input.tokenLabel));
  }
  lines.push(escposPlainDivider(paper, '-'));

  lines.push(prep('To,'));
  lines.push(prep(input.customerLabel.trim() || '—'));
  pushMetaPlain('Phone', input.phoneLabel);
  if (input.customerEmail?.trim()) {
    pushMetaPlain('Email', input.customerEmail.trim());
  }
  if (input.regNo?.trim()) pushMetaPlain('Reg no', input.regNo.trim());
  if (input.hostelBlock?.trim()) pushMetaPlain('Block', input.hostelBlock.trim());
  if (input.roomNumber?.trim()) pushMetaPlain('Room', input.roomNumber.trim());
  lines.push(escposPlainDivider(paper, '-'));

  lines.push(escposPlainTableRowPreview(paper, 'Qty', 'Item', 'Amount'));
  lines.push(escposPlainDivider(paper, '-'));

  input.lineItems.forEach((l, idx) => {
    const descFull = `${idx + 1}. ${plainItemDescForPreview(l.label, l.price, prep)}`;
    const descLines = wrapToMidWidth(descFull, mw, prep);
    const first = descLines[0] ?? '';
    lines.push(escposPlainTableRowPreview(paper, String(l.qty), first, rsMoney(l.qty * l.price)));
    for (let i = 1; i < descLines.length; i += 1) {
      lines.push(' '.repeat(lw) + prep(descLines[i]).slice(0, mw));
    }
  });

  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainTwoColumnPreview(paper, 'Total Qty', String(input.totalItems)));
  lines.push(escposPlainTwoColumnPreview(paper, 'Subtotal', rsMoney(input.subtotal)));
  pushServiceFeePlain(lines, paper, input.convenienceFee, input.convenienceFeeOriginal);

  lines.push(escposPlainDivider(paper, '='));
  lines.push(totalLinePadded(paper, 'Net Amount', rsMoney(input.total), prep));
  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainLineCenterPreview(paper, 'Have a nice day'));
  lines.push(escposPlainLineCenterPreview(paper, 'Thanks for your visit!'));
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
