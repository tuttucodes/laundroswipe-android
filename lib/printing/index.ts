import { tryNativeEscPosPrint } from '@/lib/native-print-bridge';
import { BluetoothPrinterService, isWebBluetoothAvailable } from './bluetooth/BluetoothPrinterService';
import { PrintQueue } from './queue/PrintQueue';
import {
  ESCPOSBuilder,
  type PaperSize,
  PAPER_FONT_A_CHARS,
  escposPlainDivider,
  escposPlainLineRight,
  escposPlainLineCenter,
} from './escpos/ESCPOSBuilder';
import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';

export type { PaperSize } from './escpos/ESCPOSBuilder';
export {
  ESCPOSBuilder,
  paperSizeFromCharsPerLine,
  escposPlainDivider,
  escposPlainTableRow,
  escposPlainLineRight,
  escposPlainLineCenter,
  PAPER_FONT_A_CHARS,
} from './escpos/ESCPOSBuilder';
export {
  buildVendorReceiptEscPos,
  formatVendorReceiptEscPosPlain,
  savedVendorBillToReceiptInput,
  type VendorReceiptInput,
  type VendorReceiptLine,
} from './receipt/vendorReceipt';
export {
  BluetoothPrinterService,
  isWebBluetoothAvailable,
  BLE_OPTIONAL_SERVICES,
  type BleConnectionState,
} from './bluetooth/BluetoothPrinterService';
export { PrintQueue } from './queue/PrintQueue';
export { isNativeEscPosBridgeAvailable, tryNativeEscPosPrint } from '@/lib/native-print-bridge';

/** Pad unit + line total on one row, or split (matches vendor receipt line layout). */
function unitTotalLines(paper: PaperSize, unitLeft: string, lineTotal: string): string[] {
  const w = PAPER_FONT_A_CHARS[paper];
  if (unitLeft.length + lineTotal.length + 1 <= w) {
    return [unitLeft + ' '.repeat(Math.max(1, w - unitLeft.length - lineTotal.length)) + lineTotal];
  }
  return [unitLeft, escposPlainLineRight(paper, lineTotal)];
}

export type BluetoothPrintResult = 'printed' | 'not-connected' | 'unavailable' | 'disabled' | 'error';

/**
 * Raw ESC/POS: Android WebView native bridge first (Classic BT), then BLE when enabled.
 */
export async function printEscPosViaBluetooth(bytes: Uint8Array): Promise<BluetoothPrintResult> {
  const native = await tryNativeEscPosPrint(bytes);
  if (native === 'ok') return 'printed';

  const prefs = getBlePrinterPreferences();
  if (!prefs.preferBluetoothEscPos) return 'disabled';
  if (!isWebBluetoothAvailable()) return 'unavailable';

  const svc = BluetoothPrinterService.getInstance();
  svc.setAutoReconnect(prefs.autoConnect);

  if (!svc.isConnected() && prefs.autoConnect) {
    await svc.reconnectFromStorage();
  }

  if (!svc.isConnected()) {
    return 'not-connected';
  }

  const queue = new PrintQueue((d) => svc.writeRaw(d), prefs.printTimeoutMs);
  try {
    await queue.enqueue(bytes);
    return 'printed';
  } catch {
    return 'error';
  }
}

/** Small test ticket — same density rules as vendor bills (compact meta, large line items). */
export function buildTestEscPosReceipt(paper: PaperSize): Uint8Array {
  const prefs = getBlePrinterPreferences();
  const b = new ESCPOSBuilder(paper);
  b.initialize().codePage(0).printDensity(prefs.printDensity);
  b.align('center').bold(true).fontSize('normal').text('LaundroSwipe');
  b.bold(false).text('Bluetooth test print');
  b.text(new Date().toLocaleString());
  b.divider();
  b.align('left').bold(true).fontSize('normal').text('LINE ITEMS').bold(false);
  const rows: { qtyLine: string; unit: string; total: string }[] = [
    { qtyLine: '2× Wash & fold', unit: '@ Rs.60.00 each', total: 'Rs.120.00' },
    { qtyLine: '1× Iron', unit: '@ Rs.45.00 each', total: 'Rs.45.00' },
  ];
  for (const r of rows) {
    b.bold(true).fontSize('doubleHeight').text(r.qtyLine);
    b.fontSize('doubleHeight').bold(true);
    const parts = unitTotalLines(paper, r.unit, r.total);
    if (parts.length === 1) {
      b.align('left').text(parts[0]);
    } else {
      b.align('left').text(parts[0]);
      b.align('right').text(r.total);
    }
    b.fontSize('normal').bold(false).align('left');
  }
  b.divider();
  b.text('Total items: 3');
  b.text('Subtotal: Rs.165.00');
  b.bold(true).fontSize('normal').text('TOTAL: Rs.165.00').bold(false);
  b.feed(1).align('center').text('OK — ' + paper);
  b.feed(3).cut(false);
  return b.build();
}

/** Plain-text mirror of `buildTestEscPosReceipt` (browser print + byte fallback). */
export function formatTestEscPosPlain(paper: PaperSize): string {
  const lines: string[] = [];
  lines.push('LaundroSwipe');
  lines.push('Bluetooth test print');
  lines.push(new Date().toLocaleString());
  lines.push(escposPlainDivider(paper));
  lines.push('LINE ITEMS');
  lines.push('2× Wash & fold');
  for (const u of unitTotalLines(paper, '@ Rs.60.00 each', 'Rs.120.00')) lines.push(u);
  lines.push('1× Iron');
  for (const u of unitTotalLines(paper, '@ Rs.45.00 each', 'Rs.45.00')) lines.push(u);
  lines.push(escposPlainDivider(paper));
  lines.push('Total items: 3');
  lines.push('Subtotal: Rs.165.00');
  lines.push(`TOTAL: Rs.165.00`);
  lines.push('');
  lines.push(escposPlainLineCenter(paper, 'OK — ' + paper));
  return lines.join('\n');
}
