import { formatTestEscPosPlain, paperSizeFromCharsPerLine } from '@/lib/printing';
import type { PaperSize } from '@/lib/printing/escpos/ESCPOSBuilder';
import { PAPER_FONT_A_CHARS } from '@/lib/printing/escpos/ESCPOSBuilder';

/**
 * Thermal receipt printing for 58mm, 68mm, and 79mm Bluetooth/USB printers.
 * - Optional Android WebView bridge (Classic Bluetooth SPP) via window.LaundroSwipeAndroidPrint
 * - Web Serial (Chrome 117+ desktop), Web Bluetooth (BLE), then system print dialog.
 * - Paper width and chars per line come from printer settings (e.g. 68mm, Epson M80 79mm).
 */

import { tryNativeEscPosPrint } from '@/lib/native-print-bridge';

export interface PrinterPrintConfig {
  paperWidthMm: number;
  charsPerLine: number;
  forceDialog?: boolean;
}

const DEFAULT_CONFIG: PrinterPrintConfig = { paperWidthMm: 78, charsPerLine: 46 };

/** Printed content width on paper (68-70mm); paper can be 78mm. */
const CONTENT_WIDTH_MM = 70;
const contentWidth = `${CONTENT_WIDTH_MM}mm`;

function getThermalStyles(paperWidthMm: number): string {
  const w = `${paperWidthMm}mm`;
  const fontCss = `font-family:"Courier New","Liberation Mono","Nimbus Mono PS",monospace;font-size:15px;font-weight:700;line-height:1.4`;
  return `
*{margin:0;padding:0}
html,body{width:${w};max-width:${w};min-width:${w};${fontCss};padding:1.2mm;margin:0;background:#fff;color:#000;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
*,*::before,*::after{box-sizing:inherit}
body{overflow:visible}
.receipt{width:${contentWidth};max-width:${contentWidth};margin:0 auto;padding:0}
h2{text-align:center;font-size:21px;font-weight:700;margin:0 0 1.5mm}
.meta{text-align:center;font-size:14px;margin:0 0 0.8mm}
p{margin:0.8mm 0;font-size:14px;word-break:break-word}
table{width:100%;border-collapse:collapse;font-size:14px;margin:1.7mm 0}
th,td{padding:0.8mm 0.6mm;font-family:Arial,"Helvetica Neue",Helvetica,sans-serif}
th{font-weight:700;text-align:left;border-bottom:1px solid #000}
td{text-align:left;vertical-align:top}
.right{text-align:right}
.center{text-align:center}
.qty-col{width:14%;text-align:left}
.desc-col{width:56%}
.amt-col{width:30%;text-align:right}
.row-divider{border-top:1px solid #000;margin:1.5mm 0}
.totals{margin-top:1mm}
.totals p{display:flex;justify-content:space-between}
.totals p span:first-child{padding-right:1mm}
.total{font-weight:700;font-size:17px;border-top:1px solid #000;padding-top:1.2mm;margin-top:1mm}
.conv{font-size:13px}
.foot{text-align:center;margin-top:2.5mm;font-size:15px}
.escpos-plain-receipt{margin:0 auto;padding:0;box-sizing:border-box;font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:12px;font-weight:600;line-height:1.35;white-space:pre;overflow-x:auto;word-break:break-word}
.escpos-vendor-wrap{margin:0 auto;padding:0;box-sizing:border-box}
.escpos-vendor-head,.escpos-vendor-tail{margin:0;padding:0 0 1px;font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:11px;font-weight:500;line-height:1.22;white-space:pre-wrap;word-break:break-word;color:#000;width:100%;border:0;background:transparent}
.escpos-vendor-items{margin:0;padding:3px 0 5px;font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:17px;font-weight:700;line-height:1.36;white-space:pre-wrap;word-break:break-word;color:#000;width:100%;border:0;background:transparent;border-top:1px solid #ddd;border-bottom:1px solid #ddd}
.escpos-hint{background:#f0f0f0;color:#333;font-size:11px;padding:8px 12px;margin:8px 0;border-radius:6px;border:1px solid #ccc}
.no-print{}
@media print{
  .escpos-hint,.no-print{display:none!important}
  html,body{width:${w}!important;max-width:${w}!important;min-width:${w}!important;padding:1.2mm!important;margin:0!important;background:#fff!important}
  .receipt{width:${contentWidth}!important;max-width:${contentWidth}!important;margin:0 auto!important}
  .escpos-vendor-head,.escpos-vendor-tail{font-size:10px!important}
  .escpos-vendor-items{font-size:16px!important}
  @page{size:${paperWidthMm}mm auto;margin:0}
}
`;
}

// ESC/POS: init, line feed, full cut
const ESC_INIT = new Uint8Array([0x1b, 0x40]);
const LF = new Uint8Array([0x0a]);
const CUT_FULL = new Uint8Array([0x1d, 0x56, 0x00]);

function buildEscPosBytes(plainText: string, charsPerLine: number = DEFAULT_CONFIG.charsPerLine): Uint8Array {
  const lines = plainText.split(/\r?\n/);
  const parts: Uint8Array[] = [ESC_INIT];
  const encoder = new TextEncoder();
  for (const line of lines) {
    let rest = line;
    while (rest.length > 0) {
      const chunk = rest.length <= charsPerLine ? rest : rest.slice(0, charsPerLine);
      rest = rest.length <= charsPerLine ? '' : rest.slice(charsPerLine);
      parts.push(encoder.encode(chunk));
      parts.push(LF);
    }
  }
  parts.push(LF, CUT_FULL);
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// Minimal type for Web Serial API (Chrome 117+); not in default DOM libs
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
}

// Web Bluetooth types (not in all DOM libs)
interface BLECharacteristicLike {
  writeValue(data: Uint8Array): Promise<void>;
}
interface BLEServiceLike {
  getCharacteristic(uuid: number): Promise<BLECharacteristicLike>;
}
interface BLEServerLike {
  getPrimaryService(uuid: number): Promise<BLEServiceLike>;
}
interface BLEDeviceLike {
  gatt?: { connected?: boolean; connect(): Promise<BLEServerLike> };
}

// Session cache: reuse same port/device so second print is one-click
let cachedSerialPort: SerialPortLike | null = null;
let cachedBleDevice: BLEDeviceLike | null = null;

function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator && typeof (navigator as unknown as { serial?: { requestPort: (o?: unknown) => Promise<SerialPortLike> } }).serial?.requestPort === 'function';
}

function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator && typeof (navigator as unknown as { bluetooth?: { requestDevice: (o: unknown) => Promise<BLEDeviceLike> } }).bluetooth?.requestDevice === 'function';
}

// Nordic UART Service (common for BLE thermal printers)
const BLE_SERVICE_UUID = 0xffe0;
const BLE_CHAR_UUID = 0xffe1;
const BLE_CHUNK_SIZE = 20;

async function writeToSerialPort(port: SerialPortLike, data: Uint8Array, keepOpen: boolean): Promise<void> {
  try {
    await port.open({ baudRate: 9600 });
  } catch (e) {
    if ((e as Error).name !== 'InvalidStateError') throw e;
    // already open (reuse)
  }
  const writer = port.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
    if (!keepOpen) await port.close();
  }
}

async function writeToBleCharacteristic(characteristic: BLECharacteristicLike, data: Uint8Array): Promise<void> {
  for (let i = 0; i < data.length; i += BLE_CHUNK_SIZE) {
    const chunk = data.subarray(i, Math.min(i + BLE_CHUNK_SIZE, data.length));
    await characteristic.writeValue(chunk);
  }
}

export type DirectPrintResult = 'native' | 'serial' | 'ble' | 'dialog' | 'blocked';

/**
 * HTML body (inside `.receipt`) for printer test — same tiered layout as vendor bills when plain matches.
 */
export function getThermalTestReceiptBodyHtml(charsPerLine: number = DEFAULT_CONFIG.charsPerLine): string {
  const paper = paperSizeFromCharsPerLine(charsPerLine);
  const plain = formatTestEscPosPlain(paper);
  return escPosPlainReceiptHtmlForPaper(plain, paper);
}

export function getThermalTestReceiptPlainText(charsPerLine: number = DEFAULT_CONFIG.charsPerLine): string {
  const paper = paperSizeFromCharsPerLine(charsPerLine);
  return formatTestEscPosPlain(paper);
}

function escapeHtmlStatic(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Monospace `<pre>` matching POS column widths (chars per line). */
export function escPosPlainToThermalReceiptHtml(plainText: string, charsPerLine: number): string {
  return (
    '<pre class="escpos-plain-receipt" style="width:' +
    charsPerLine +
    'ch;max-width:100%">' +
    escapeHtml(plainText) +
    '</pre>'
  );
}

const VENDOR_PLAIN_LINE_ITEMS = 'LINE ITEMS';
const VENDOR_PLAIN_TOTAL_ITEMS = 'Total items:';

/**
 * Vendor receipt preview: smaller type for header/meta/totals; large bold block for line items only.
 */
export function escPosPlainReceiptHtmlForPaper(plainText: string, paper: PaperSize): string {
  const w = PAPER_FONT_A_CHARS[paper];
  const lines = plainText.split(/\n/);
  const li = lines.findIndex((l) => l === VENDOR_PLAIN_LINE_ITEMS);
  const ti = lines.findIndex((l) => l.startsWith(VENDOR_PLAIN_TOTAL_ITEMS));
  if (li < 0 || ti < 0 || ti <= li) {
    return escPosPlainToThermalReceiptHtml(plainText, w);
  }
  const head = lines.slice(0, li + 1).join('\n');
  const items = lines.slice(li + 1, ti).join('\n');
  const tail = lines.slice(ti).join('\n');
  return (
    '<div class="escpos-vendor-wrap" style="width:' +
    w +
    'ch;max-width:100%">' +
    '<pre class="escpos-vendor-head">' +
    escapeHtmlStatic(head) +
    '</pre><pre class="escpos-vendor-items">' +
    escapeHtmlStatic(items) +
    '</pre><pre class="escpos-vendor-tail">' +
    escapeHtmlStatic(tail) +
    '</pre></div>'
  );
}

/** Match BLE / ESC/POS paper labels to @page width used by thermal preview HTML. */
export function paperWidthMmFromLabel(size: '58mm' | '76mm' | '78mm' | '80mm'): number {
  if (size === '58mm') return 58;
  if (size === '76mm') return 76;
  if (size === '78mm') return 78;
  return 80;
}

/**
 * Print-dialog / plain-byte char width aligned to BLE ESC/POS paper (not admin printer model),
 * so wrapped receipt lines match `formatVendorReceiptEscPosPlain`.
 */
export function thermalPrinterConfigForEscPosPlain(
  paper: PaperSize,
  admin?: { forceDialog?: boolean } | null,
): PrinterPrintConfig {
  return {
    paperWidthMm: paperWidthMmFromLabel(paper),
    charsPerLine: PAPER_FONT_A_CHARS[paper],
    forceDialog: admin?.forceDialog !== false,
  };
}

export type ThermalReceiptWindowOptions = {
  /** Hide the “ESCPOS Bluetooth Print Service” hint. */
  omitEscposServiceHint?: boolean;
};

/**
 * Opens a narrow window with thermal receipt HTML and triggers the print dialog.
 */
export function openThermalReceiptWindow(
  title: string,
  bodyHtml: string,
  paperWidthMm: number = DEFAULT_CONFIG.paperWidthMm,
  options?: ThermalReceiptWindowOptions,
): boolean {
  const omitEscposServiceHint = options?.omitEscposServiceHint === true;
  const w = window.open('', '_blank', 'width=360,height=640,menubar=no,toolbar=no,scrollbars=yes');
  if (!w) return false;
  const styles = getThermalStyles(paperWidthMm);
  const escposHint = omitEscposServiceHint
    ? ''
    : '<p class="escpos-hint"><strong>In the print dialog, select: ESCPOS Bluetooth Print Service</strong> (then choose your printer if asked).</p>';
  const closeLink =
    '<p class="no-print" style="margin-top:8px"><a href="#" onclick="window.close();return false" style="color:#666;font-size:10px">Close window after printing</a></p>';
  const doc = w.document;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' +
      escapeHtml(title) +
      '</title>' +
      '<style>' +
      styles +
      '</style></head><body>' +
      escposHint +
      '<div class="receipt">' +
      bodyHtml +
      closeLink +
      '</div></body></html>',
  );
  doc.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch (_) {
      // ignore
    }
  }, 500);
  return true;
}

/**
 * Try to print directly to a Bluetooth thermal printer (Web Serial or Web Bluetooth),
 * then fall back to system print dialog. Returns which method was used.
 * Call from a user gesture (e.g. button click).
 */
export async function printThermalReceiptDirect(
  title: string,
  bodyHtml: string,
  plainText: string,
  options?: { forceDialog?: boolean; printer?: PrinterPrintConfig; escPosPayload?: Uint8Array }
): Promise<DirectPrintResult> {
  const forceDialog = options?.forceDialog === true;
  const config = options?.printer ?? DEFAULT_CONFIG;
  const effectiveForceDialog = forceDialog || (config && 'forceDialog' in config && config.forceDialog === true);
  const escPosBytes =
    options?.escPosPayload && options.escPosPayload.length > 0
      ? options.escPosPayload
      : buildEscPosBytes(plainText, config.charsPerLine);

  if (!effectiveForceDialog) {
    const native = await tryNativeEscPosPrint(escPosBytes);
    if (native === 'ok') return 'native';
  }

  if (!effectiveForceDialog && isSerialSupported()) {
    try {
      let port = cachedSerialPort;
      if (!port) {
        const nav = navigator as unknown as { serial: { requestPort: (opts?: { filters?: unknown[] }) => Promise<SerialPortLike> } };
        port = await nav.serial.requestPort({});
        cachedSerialPort = port;
      }
      await writeToSerialPort(port, escPosBytes, true);
      return 'serial';
    } catch (e) {
      if ((e as Error).name === 'NotFoundError') {
        cachedSerialPort = null;
      }
      // fall through to BLE or dialog
    }
  }

  if (!effectiveForceDialog && isBluetoothSupported()) {
    try {
      let device = cachedBleDevice;
      if (!device || !device.gatt?.connected) {
        const nav = navigator as unknown as { bluetooth: { requestDevice: (o: { filters?: { services?: number[] }[]; optionalServices?: number[] }) => Promise<BLEDeviceLike> } };
        device = await nav.bluetooth.requestDevice({
          filters: [{ services: [BLE_SERVICE_UUID] }],
          optionalServices: [BLE_SERVICE_UUID],
        });
        cachedBleDevice = device;
      }
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(BLE_CHAR_UUID);
      await writeToBleCharacteristic(characteristic, escPosBytes);
      return 'ble';
    } catch (e) {
      if ((e as Error).name === 'NotFoundError') {
        cachedBleDevice = null;
      }
      // fall through to dialog
    }
  }

  // Fallback: open print window and show system print dialog
  const ok = printThermalReceipt(title, bodyHtml, config.paperWidthMm);
  return ok ? 'dialog' : 'blocked';
}

/**
 * Opens a new window with the receipt HTML and triggers the system print dialog.
 * Use when direct print is not available (e.g. Android with Classic-only printer).
 */
export function printThermalReceipt(title: string, bodyHtml: string, paperWidthMm: number = DEFAULT_CONFIG.paperWidthMm): boolean {
  return openThermalReceiptWindow(title, bodyHtml, paperWidthMm);
}

/**
 * Opens a new window with a full-page (A4-friendly) bill and triggers the system print dialog.
 * Use this for regular / inbuilt printers (not thermal receipt printers).
 */
export function printFullPageBill(title: string, bodyHtml: string): boolean {
  const w = window.open('', '_blank', 'width=600,height=800,menubar=no,toolbar=no');
  if (!w) return false;
  const styles = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:14px;line-height:1.5;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.receipt{max-width:400px;margin:24px auto;padding:24px;border:1px solid #ddd;border-radius:8px}
h2{text-align:center;font-size:22px;font-weight:700;margin:0 0 4px}
.meta{text-align:center;font-size:13px;color:#666;margin:0 0 2px}
p{margin:3px 0;font-size:14px}
.center{text-align:center}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{padding:6px 4px;text-align:left;vertical-align:top;border-bottom:1px solid #eee}
th{font-weight:700;border-bottom:2px solid #333}
.qty-col{width:12%;text-align:center}
.desc-col{width:58%}
.amt-col{width:30%;text-align:right}
.row-divider{border-top:1px solid #333;margin:10px 0}
.totals{margin-top:8px}
.totals p{display:flex;justify-content:space-between;padding:2px 0}
.total{font-weight:700;font-size:16px;border-top:2px solid #333;padding-top:6px;margin-top:6px}
.conv{font-size:13px;color:#666}
.foot{text-align:center;margin-top:16px;font-size:14px;color:#666}
.no-print{}
@media print{
  .no-print{display:none!important}
  .receipt{border:none;margin:0 auto;padding:0}
  @page{size:A4;margin:20mm}
}
`;
  const closeLink = '<p class="no-print" style="margin-top:12px;text-align:center"><a href="#" onclick="window.close();return false" style="color:#666;font-size:11px">Close window after printing</a></p>';
  const doc = w.document;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' + styles + '</style></head><body>' +
      '<div class="receipt">' +
      bodyHtml +
      closeLink +
      '</div></body></html>'
  );
  doc.close();
  w.focus();
  setTimeout(() => {
    try { w.print(); } catch (_) { /* ignore */ }
  }, 500);
  return true;
}

function escapeHtml(s: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = s;
    return div.innerHTML;
  }
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
