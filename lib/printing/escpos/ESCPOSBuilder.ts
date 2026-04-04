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
import { encodeAsciiLines, sanitizeReceiptText } from './CharacterEncodings';

export type PaperSize = '58mm' | '76mm' | '80mm';

const PAPER_FONT_A_CHARS: Record<PaperSize, number> = {
  '58mm': 32,
  '76mm': 42,
  '80mm': 48,
};

const PAPER_MAX_DOTS: Record<PaperSize, number> = {
  '58mm': 384,
  '76mm': 576,
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
    const c = char.slice(0, 1) || '-';
    const line = c.repeat(this.charsPerLine);
    return this.text(line);
  }

  /**
   * Three columns: left (e.g. qty), mid (description), right (amount). Widths sum to chars/line.
   */
  tableRow(left: string, mid: string, right: string): this {
    const w = this.charsPerLine;
    const lw = Math.min(5, Math.max(3, Math.floor(w * 0.14)));
    const rw = Math.min(10, Math.max(6, Math.floor(w * 0.3)));
    const mw = Math.max(4, w - lw - rw);
    const L = sanitizeReceiptText(left).slice(0, lw).padEnd(lw);
    const R = sanitizeReceiptText(right).slice(0, rw).padStart(rw);
    const M = sanitizeReceiptText(mid).slice(0, mw).padEnd(mw);
    return this.text(L + M + R);
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
  if (chars <= 46) return '76mm';
  return '80mm';
}
