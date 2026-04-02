/**
 * Thermal receipt printing for 58mm, 68mm, and 79mm Bluetooth/USB printers.
 * - Tries direct print via Web Serial (Chrome 117+ desktop, Bluetooth SPP) or
 *   Web Bluetooth (BLE printers), then falls back to system print dialog.
 * - Paper width and chars per line come from printer settings (e.g. 68mm, Epson M80 79mm).
 */

export interface PrinterPrintConfig {
  paperWidthMm: number;
  charsPerLine: number;
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
.escpos-hint{background:#f0f0f0;color:#333;font-size:11px;padding:8px 12px;margin:8px 0;border-radius:6px;border:1px solid #ccc}
.no-print{}
@media print{
  .escpos-hint,.no-print{display:none!important}
  html,body{width:${w}!important;max-width:${w}!important;min-width:${w}!important;padding:1.2mm!important;margin:0!important;background:#fff!important}
  .receipt{width:${contentWidth}!important;max-width:${contentWidth}!important;margin:0 auto!important}
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

export type DirectPrintResult = 'serial' | 'ble' | 'dialog' | 'blocked';

/**
 * Try to print directly to a Bluetooth thermal printer (Web Serial or Web Bluetooth),
 * then fall back to system print dialog. Returns which method was used.
 * Call from a user gesture (e.g. button click).
 */
export async function printThermalReceiptDirect(
  title: string,
  bodyHtml: string,
  plainText: string,
  options?: { forceDialog?: boolean; printer?: PrinterPrintConfig }
): Promise<DirectPrintResult> {
  const forceDialog = options?.forceDialog === true;
  const config = options?.printer ?? DEFAULT_CONFIG;
  const effectiveForceDialog = forceDialog || (config && 'forceDialog' in config && config.forceDialog === true);
  const escPosBytes = buildEscPosBytes(plainText, config.charsPerLine);

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
 * paperWidthMm defaults to 58 if not provided.
 */
export function printThermalReceipt(title: string, bodyHtml: string, paperWidthMm: number = DEFAULT_CONFIG.paperWidthMm): boolean {
  const w = window.open('', '_blank', 'width=320,height=480,menubar=no,toolbar=no');
  if (!w) return false;
  const styles = getThermalStyles(paperWidthMm);
  const escposHint = '<p class="escpos-hint"><strong>In the print dialog, select: ESCPOS Bluetooth Print Service</strong> (then choose your printer if asked).</p>';
  const closeLink = '<p class="no-print" style="margin-top:8px"><a href="#" onclick="window.close();return false" style="color:#666;font-size:10px">Close window after printing</a></p>';
  const doc = w.document;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' + styles + '</style></head><body>' +
      escposHint +
      '<div class="receipt">' +
      bodyHtml +
      closeLink +
      '</div></body></html>'
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

function escapeHtml(s: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = s;
    return div.innerHTML;
  }
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
