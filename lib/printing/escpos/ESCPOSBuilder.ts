import {
  ALIGN_CENTER,
  ALIGN_LEFT,
  ALIGN_RIGHT,
  BOLD_OFF,
  BOLD_ON,
  CMD_CUT_FULL,
  CMD_INIT,
  CMD_LF,
  ESC,
  FONT_DH,
  FONT_DWH,
  FONT_DW,
  FONT_NORMAL,
  GS,
  LF,
  UNDERLINE_OFF,
  UNDERLINE_ON,
} from './ESCPOSConstants';
import { encodeAsciiLines, sanitizeReceiptText, sanitizeReceiptTextForPreview } from './CharacterEncodings';

export type PaperSize = '58mm' | '76mm' | '78mm' | '80mm';

/**
 * Font A characters per line — must match Admin → Printers `charsPerLine` for that width.
 * 78mm (~3") roll is typically 46 chars; was incorrectly bucketed into 76mm/42 and broke tables.
 */
export const PAPER_FONT_A_CHARS: Record<PaperSize, number> = {
  '58mm': 32,
  '76mm': 42,
  '78mm': 46,
  '80mm': 48,
};

/** Column widths for `tableRow` / receipt line items (qty | description | amount). */
export function escposTableColumnWidths(paper: PaperSize): { lw: number; mw: number; rw: number } {
  const w = PAPER_FONT_A_CHARS[paper];
  const lw = Math.min(5, Math.max(3, Math.floor(w * 0.12)));
  const rw = Math.min(12, Math.max(7, Math.floor(w * 0.32)));
  const mw = Math.max(4, w - lw - rw);
  return { lw, mw, rw };
}

/** Spaces printed between Q|R and R|A so numeric columns do not run together. */
export const ESCPOS_INVOICE_NUM_GAPS = 2;

/**
 * Four-column invoice row (item | qty | rate | amount). No serial column.
 * Two single-char gaps in the numeric block; widths sum to chars/line.
 */
export function escposInvoiceColumnWidths(paper: PaperSize): { d: number; q: number; r: number; a: number } {
  const w = PAPER_FONT_A_CHARS[paper];
  const g = ESCPOS_INVOICE_NUM_GAPS;
  const a = Math.min(11, Math.max(9, Math.floor(w * 0.24)));
  const r = Math.min(10, Math.max(7, Math.floor(w * 0.2)));
  const q = 4;
  const d = Math.max(8, w - q - r - a - g);
  return { d, q, r, a };
}

function buildInvoiceRow4String(
  paper: PaperSize,
  desc: string,
  qty: string,
  rate: string,
  amt: string,
  sanitizer: (x: string) => string,
): string {
  const { d, q, r, a } = escposInvoiceColumnWidths(paper);
  const D = sanitizer(desc).slice(0, d).padEnd(d);
  const Q = sanitizer(qty).slice(0, q).padStart(q);
  const R = sanitizer(rate).slice(0, r).padStart(r);
  const A = sanitizer(amt).slice(0, a).padStart(a);
  return `${D}${Q} ${R} ${A}`;
}

export function escposPlainInvoiceRow4(
  paper: PaperSize,
  desc: string,
  qty: string,
  rate: string,
  amt: string,
): string {
  return buildInvoiceRow4String(paper, desc, qty, rate, amt, sanitizeReceiptText);
}

export function escposPlainInvoiceRow4Preview(
  paper: PaperSize,
  desc: string,
  qty: string,
  rate: string,
  amt: string,
): string {
  return buildInvoiceRow4String(paper, desc, qty, rate, amt, sanitizeReceiptTextForPreview);
}

/** Wrapped item description continuation (numeric columns blank). */
export function escposPlainInvoiceRow4Cont(paper: PaperSize, desc: string): string {
  const { d, q, r, a } = escposInvoiceColumnWidths(paper);
  const D = sanitizeReceiptText(desc).slice(0, d).padEnd(d);
  return `${D}${' '.repeat(q + r + a + ESCPOS_INVOICE_NUM_GAPS)}`;
}

export function escposPlainInvoiceRow4ContPreview(paper: PaperSize, desc: string): string {
  const { d, q, r, a } = escposInvoiceColumnWidths(paper);
  const D = sanitizeReceiptTextForPreview(desc).slice(0, d).padEnd(d);
  return `${D}${' '.repeat(q + r + a + ESCPOS_INVOICE_NUM_GAPS)}`;
}

/** Plain-text line matching ESC/POS `divider()` for preview windows (BLE / native path). */
export function escposPlainDivider(paper: PaperSize, char = '-'): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const c = char.slice(0, 1) || '-';
  return c.repeat(w);
}

/** Plain-text line matching ESC/POS `tableRow()` for preview windows. */
export function escposPlainTableRow(paper: PaperSize, left: string, mid: string, right: string): string {
  const { lw, mw, rw } = escposTableColumnWidths(paper);
  const L = sanitizeReceiptText(left).slice(0, lw).padEnd(lw);
  const R = sanitizeReceiptText(right).slice(0, rw).padStart(rw);
  const M = sanitizeReceiptText(mid).slice(0, mw).padEnd(mw);
  return L + M + R;
}

/** Same column layout as `escposPlainTableRow` but keeps UTF-8 for browser/Arial preview. */
export function escposPlainTableRowPreview(paper: PaperSize, left: string, mid: string, right: string): string {
  const { lw, mw, rw } = escposTableColumnWidths(paper);
  const L = sanitizeReceiptTextForPreview(left).slice(0, lw).padEnd(lw);
  const R = sanitizeReceiptTextForPreview(right).slice(0, rw).padStart(rw);
  const M = sanitizeReceiptTextForPreview(mid).slice(0, mw).padEnd(mw);
  return L + M + R;
}

/** Right-aligned line within paper width (matches typical `align('right').text(...)`). */
export function escposPlainLineRight(paper: PaperSize, text: string): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const t = sanitizeReceiptText(text);
  if (t.length >= w) return t.slice(0, w);
  return t.padStart(w);
}

/** Centered line within paper width. */
export function escposPlainLineCenter(paper: PaperSize, text: string): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const t = sanitizeReceiptText(text);
  if (t.length >= w) return t.slice(0, w);
  const pad = Math.max(0, Math.floor((w - t.length) / 2));
  return ' '.repeat(pad) + t;
}

export function escposPlainLineCenterPreview(paper: PaperSize, text: string): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const t = sanitizeReceiptTextForPreview(text);
  if (t.length >= w) return t.slice(0, w);
  const pad = Math.max(0, Math.floor((w - t.length) / 2));
  return ' '.repeat(pad) + t;
}

/** Left and right on one line (e.g. Bill# … · date). */
export function escposPlainTwoColumn(paper: PaperSize, left: string, right: string): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const R = sanitizeReceiptText(right);
  const Lfull = sanitizeReceiptText(left);
  const rLen = Math.min(R.length, w - 1);
  const Rpart = R.slice(0, rLen);
  const maxLeft = w - Rpart.length;
  const L = Lfull.length <= maxLeft ? Lfull : Lfull.slice(0, Math.max(0, maxLeft - 1)) + '…';
  return L.padEnd(w - Rpart.length) + Rpart;
}

export function escposPlainTwoColumnPreview(paper: PaperSize, left: string, right: string): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const R = sanitizeReceiptTextForPreview(right);
  const Lfull = sanitizeReceiptTextForPreview(left);
  const rLen = Math.min(R.length, w - 1);
  const Rpart = R.slice(0, rLen);
  const maxLeft = w - Rpart.length;
  const L = Lfull.length <= maxLeft ? Lfull : Lfull.slice(0, Math.max(0, maxLeft - 1)) + '…';
  return L.padEnd(w - Rpart.length) + Rpart;
}

const PAPER_MAX_DOTS: Record<PaperSize, number> = {
  '58mm': 384,
  '76mm': 576,
  '78mm': 608,
  '80mm': 640,
};

function concatParts(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export class ESCPOSBuilder {
  private readonly paper: PaperSize;
  private readonly charsPerLine: number;
  private readonly maxDots: number;
  private parts: Uint8Array[] = [];

  constructor(paper: PaperSize) {
    this.paper = paper;
    this.charsPerLine = PAPER_FONT_A_CHARS[paper];
    this.maxDots = PAPER_MAX_DOTS[paper];
  }

  getPaperSize(): PaperSize {
    return this.paper;
  }

  getCharsPerLine(): number {
    return this.charsPerLine;
  }

  getMaxDots(): number {
    return this.maxDots;
  }

  private pushBytes(...bytes: number[]): this {
    this.parts.push(new Uint8Array(bytes));
    return this;
  }

  private pushRaw(u: Uint8Array): this {
    this.parts.push(u);
    return this;
  }

  initialize(): this {
    return this.pushRaw(CMD_INIT);
  }

  /** Set code page (n = table number, PC437 = 0) */
  codePage(n: number): this {
    return this.pushBytes(ESC, 0x74, n & 0xff);
  }

  /**
   * Print density (printer-specific; many Epson-compatible accept GS | n).
   * light=1, medium=2, dark=3
   */
  printDensity(level: 'light' | 'medium' | 'dark'): this {
    const n = level === 'light' ? 1 : level === 'medium' ? 2 : 3;
    return this.pushBytes(GS, 0x7c, n);
  }

  lineFeed(): this {
    return this.pushRaw(CMD_LF);
  }

  feed(n: number): this {
    const lines = Math.min(255, Math.max(0, Math.floor(n)));
    if (lines <= 0) return this;
    return this.pushBytes(ESC, 0x64, lines);
  }

  align(dir: 'left' | 'center' | 'right'): this {
    if (dir === 'center') return this.pushRaw(ALIGN_CENTER);
    if (dir === 'right') return this.pushRaw(ALIGN_RIGHT);
    return this.pushRaw(ALIGN_LEFT);
  }

  bold(on: boolean): this {
    return this.pushRaw(on ? BOLD_ON : BOLD_OFF);
  }

  underline(on: boolean): this {
    return this.pushRaw(on ? UNDERLINE_ON : UNDERLINE_OFF);
  }

  fontSize(mode: 'normal' | 'doubleHeight' | 'doubleWidth' | 'doubleBoth'): this {
    if (mode === 'doubleHeight') return this.pushRaw(FONT_DH);
    if (mode === 'doubleWidth') return this.pushRaw(FONT_DW);
    if (mode === 'doubleBoth') return this.pushRaw(FONT_DWH);
    return this.pushRaw(FONT_NORMAL);
  }

  text(line: string): this {
    const safe = sanitizeReceiptText(line);
    const enc = new TextEncoder();
    this.parts.push(enc.encode(safe));
    this.parts.push(CMD_LF);
    return this;
  }

  textDoubleSize(line: string): this {
    this.pushRaw(FONT_DWH);
    this.text(line);
    this.pushRaw(FONT_NORMAL);
    return this;
  }

  rawText(line: string): this {
    this.parts.push(encodeAsciiLines(line));
    return this;
  }

  divider(char = '-'): this {
    return this.text(escposPlainDivider(this.paper, char));
  }

  /**
   * Three columns: left (e.g. qty), mid (description), right (amount). Widths sum to chars/line.
   */
  tableRow(left: string, mid: string, right: string): this {
    return this.text(escposPlainTableRow(this.paper, left, mid, right));
  }

  /** Same column layout as `tableRow`, but middle column printed in bold (item line on bills). */
  tableRowBoldMid(left: string, mid: string, right: string): this {
    const { lw, mw, rw } = escposTableColumnWidths(this.paper);
    const L = sanitizeReceiptText(left).slice(0, lw).padEnd(lw);
    const M = sanitizeReceiptText(mid).slice(0, mw).padEnd(mw);
    const R = sanitizeReceiptText(right).slice(0, rw).padStart(rw);
    const enc = new TextEncoder();
    this.pushRaw(ALIGN_LEFT);
    this.parts.push(enc.encode(L));
    this.pushRaw(BOLD_ON);
    this.parts.push(enc.encode(M));
    this.pushRaw(BOLD_OFF);
    this.parts.push(enc.encode(R));
    this.pushRaw(CMD_LF);
    return this;
  }

  /** Wrapped item description continuation: bold middle column, empty qty/amount columns. */
  tableRowMidContinuationBold(mid: string): this {
    const { lw, mw, rw } = escposTableColumnWidths(this.paper);
    const M = sanitizeReceiptText(mid).slice(0, mw).padEnd(mw);
    const enc = new TextEncoder();
    this.pushRaw(ALIGN_LEFT);
    this.parts.push(enc.encode(' '.repeat(lw)));
    this.pushRaw(BOLD_ON);
    this.parts.push(enc.encode(M));
    this.pushRaw(BOLD_OFF);
    this.parts.push(enc.encode(' '.repeat(rw)));
    this.pushRaw(CMD_LF);
    return this;
  }

  /** Invoice table header row (all bold): Item | Qty | Rate | Amt */
  invoiceHeaderRow4(descHdr: string, qtyHdr: string, rateHdr: string, amtHdr: string): this {
    const line = buildInvoiceRow4String(this.paper, descHdr, qtyHdr, rateHdr, amtHdr, sanitizeReceiptText);
    const enc = new TextEncoder();
    this.pushRaw(ALIGN_LEFT);
    this.pushRaw(BOLD_ON);
    this.parts.push(enc.encode(line));
    this.pushRaw(BOLD_OFF);
    this.pushRaw(CMD_LF);
    return this;
  }

  /**
   * Invoice line: item name double-height + bold; qty / rate / amt normal
   * (GS ! 0x01 + ESC E on description only).
   */
  invoiceRow4BoldDesc(desc: string, qty: string, rate: string, amt: string): this {
    const { d, q, r, a } = escposInvoiceColumnWidths(this.paper);
    const D = sanitizeReceiptText(desc).slice(0, d).padEnd(d);
    const Q = sanitizeReceiptText(qty).slice(0, q).padStart(q);
    const R = sanitizeReceiptText(rate).slice(0, r).padStart(r);
    const A = sanitizeReceiptText(amt).slice(0, a).padStart(a);
    const tail = `${Q} ${R} ${A}`;
    const enc = new TextEncoder();
    this.pushRaw(ALIGN_LEFT);
    this.pushRaw(FONT_NORMAL);
    this.pushRaw(FONT_DH);
    this.pushRaw(BOLD_ON);
    this.parts.push(enc.encode(D));
    this.pushRaw(BOLD_OFF);
    this.pushRaw(FONT_NORMAL);
    this.parts.push(enc.encode(tail));
    this.pushRaw(CMD_LF);
    return this;
  }

  /** Wrapped item line: double-height + bold description; numeric columns blank. */
  invoiceRow4ContinuationBold(desc: string): this {
    const { d, q, r, a } = escposInvoiceColumnWidths(this.paper);
    const D = sanitizeReceiptText(desc).slice(0, d).padEnd(d);
    const tail = ' '.repeat(q + r + a + ESCPOS_INVOICE_NUM_GAPS);
    const enc = new TextEncoder();
    this.pushRaw(ALIGN_LEFT);
    this.pushRaw(FONT_DH);
    this.pushRaw(BOLD_ON);
    this.parts.push(enc.encode(D));
    this.pushRaw(BOLD_OFF);
    this.pushRaw(FONT_NORMAL);
    this.parts.push(enc.encode(tail));
    this.pushRaw(CMD_LF);
    return this;
  }

  twoColumn(left: string, right: string): this {
    return this.text(escposPlainTwoColumn(this.paper, left, right));
  }

  /** Code128: GS k m n d1..dn (m = 0x49) */
  barcodeCode128(data: string): this {
    const raw = sanitizeReceiptText(data).replace(/[^A-Za-z0-9]/g, '');
    if (!raw.length) return this;
    const enc = new TextEncoder();
    const body = enc.encode(raw);
    const n = Math.min(255, body.length);
    this.pushBytes(GS, 0x68, 0x50); // height
    this.pushBytes(GS, 0x77, 0x02); // width
    this.pushBytes(GS, 0x6b, 0x49, n);
    this.parts.push(body.subarray(0, n));
    this.pushRaw(CMD_LF);
    return this;
  }

  /**
   * QR (model 2) — EPSON-style GS ( k. Unsupported printers may skip or print garbage;
   * keep QR short.
   */
  qrCode(data: string): this {
    const enc = new TextEncoder();
    const bytes = enc.encode(sanitizeReceiptText(data));
    if (bytes.length > 600) {
      return this.text('[QR too long]');
    }
    // Model 2
    this.pushBytes(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Cell size
    this.pushBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06);
    // Error correction M
    this.pushBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
    const storeLen = 3 + bytes.length;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;
    this.pushBytes(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    this.parts.push(bytes);
    // Print
    this.pushBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.pushRaw(CMD_LF);
    return this;
  }

  cut(partial = false): this {
    return this.pushBytes(GS, 0x56, partial ? 0x01 : 0x00);
  }

  build(): Uint8Array {
    return concatParts(this.parts);
  }
}

export function paperSizeFromCharsPerLine(chars: number): PaperSize {
  if (chars <= 34) return '58mm';
  if (chars <= 42) return '76mm';
  if (chars <= 47) return '78mm';
  return '80mm';
}
