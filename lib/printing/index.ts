import { tryNativeEscPosPrint } from '@/lib/native-print-bridge';
import { BluetoothPrinterService, isWebBluetoothAvailable } from './bluetooth/BluetoothPrinterService';
import { PrintQueue } from './queue/PrintQueue';
import {
  ESCPOSBuilder,
  type PaperSize,
  escposPlainDivider,
  escposPlainTableRow,
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

/** Small test ticket for alignment checks. */
export function buildTestEscPosReceipt(paper: PaperSize): Uint8Array {
  const prefs = getBlePrinterPreferences();
  const b = new ESCPOSBuilder(paper);
  b.initialize().codePage(0).printDensity(prefs.printDensity);
  b.align('center').bold(true).textDoubleSize('LaundroSwipe').bold(false);
  b.text('Bluetooth test print');
  b.text(new Date().toLocaleString());
  b.divider();
  b.align('left');
  b.tableRow('Qty', 'Item', 'Amt');
  b.tableRow('2', 'Wash & fold', 'Rs.120.00');
  b.tableRow('1', 'Iron', 'Rs.45.00');
  b.divider();
  b.align('right').bold(true).text('TOTAL: Rs.165.00').bold(false);
  b.feed(2).align('center').text('OK — ' + paper);
  b.feed(4).cut(false);
  return b.build();
}

/** Plain-text mirror of `buildTestEscPosReceipt` (browser print + byte fallback). */
export function formatTestEscPosPlain(paper: PaperSize): string {
  const lines: string[] = [];
  lines.push('LaundroSwipe');
  lines.push('Bluetooth test print');
  lines.push(new Date().toLocaleString());
  lines.push(escposPlainDivider(paper));
  lines.push(escposPlainTableRow(paper, 'Qty', 'Item', 'Amt'));
  lines.push(escposPlainTableRow(paper, '2', 'Wash & fold', 'Rs.120.00'));
  lines.push(escposPlainTableRow(paper, '1', 'Iron', 'Rs.45.00'));
  lines.push(escposPlainDivider(paper));
  lines.push(escposPlainLineRight(paper, 'TOTAL: Rs.165.00'));
  lines.push('');
  lines.push(escposPlainLineCenter(paper, 'OK — ' + paper));
  return lines.join('\n');
}
