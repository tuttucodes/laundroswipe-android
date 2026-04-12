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
  escposPlainTwoColumn,
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

/** Small test ticket — same tax-invoice section style as vendor bills. */
export function buildTestEscPosReceipt(paper: PaperSize): Uint8Array {
  const prefs = getBlePrinterPreferences();
  const b = new ESCPOSBuilder(paper);
  b.initialize().codePage(0).printDensity(prefs.printDensity);
  b.divider('-');
  b.feed(1);
  b.align('center').bold(true).fontSize('doubleHeight').text('LaundroSwipe').fontSize('normal').bold(false);
  b.text('Printer test');
  b.feed(1);
  b.bold(true).text('TAX INVOICE').bold(false);
  b.feed(1);
  b.align('left');
  b.text('Bill To : Test customer');
  b.twoColumn('Bill#: TEST', new Date().toLocaleString());
  b.feed(1);
  b.divider('-');
  b.bold(true).tableRow('Qty', 'Item / Rate', 'Amount').bold(false);
  b.text('Wash & fold');
  b.tableRow('2', '@Rs.60.00', 'Rs.120.00');
  b.feed(1);
  b.text('Iron');
  b.tableRow('1', '@Rs.45.00', 'Rs.45.00');
  b.feed(1);
  b.divider('=');
  b.feed(1);
  b.align('right');
  b.text('Subtotal: Rs.165.00');
  b.text('Service fee: Rs.0 (7-day discount)');
  b.bold(true).fontSize('doubleHeight').text('TOTAL: Rs.165.00').fontSize('normal').bold(false);
  b.align('left');
  b.feed(1);
  b.text('Cashier: admin');
  b.feed(1);
  b.divider('-');
  b.align('center');
  b.feed(1);
  b.bold(true).text('THANK YOU AND COME AGAIN').bold(false);
  b.text('Total items: 3');
  b.feed(2).text('OK — ' + paper);
  b.feed(10).cut(false);
  return b.build();
}

/** Plain-text mirror of `buildTestEscPosReceipt` (browser print + byte fallback). */
export function formatTestEscPosPlain(paper: PaperSize): string {
  const lines: string[] = [];
  lines.push(escposPlainDivider(paper, '-'));
  lines.push('');
  lines.push(escposPlainLineCenter(paper, 'LaundroSwipe'));
  lines.push(escposPlainLineCenter(paper, 'Printer test'));
  lines.push('');
  lines.push(escposPlainLineCenter(paper, 'TAX INVOICE'));
  lines.push('');
  lines.push('Bill To : Test customer');
  lines.push(escposPlainTwoColumn(paper, 'Bill#: TEST', new Date().toLocaleString()));
  lines.push('');
  lines.push(escposPlainDivider(paper, '-'));
  lines.push(escposPlainTableRow(paper, 'Qty', 'Item / Rate', 'Amount'));
  lines.push('Wash & fold');
  lines.push(escposPlainTableRow(paper, '2', '@Rs.60.00', 'Rs.120.00'));
  lines.push('');
  lines.push('Iron');
  lines.push(escposPlainTableRow(paper, '1', '@Rs.45.00', 'Rs.45.00'));
  lines.push('');
  lines.push(escposPlainDivider(paper, '='));
  lines.push('');
  lines.push(escposPlainLineRight(paper, 'Subtotal: Rs.165.00'));
  lines.push(escposPlainLineRight(paper, 'Service fee: Rs.0 (7-day discount)'));
  lines.push(escposPlainLineRight(paper, 'TOTAL: Rs.165.00'));
  lines.push('');
  lines.push('Cashier: admin');
  lines.push('');
  lines.push(escposPlainDivider(paper, '-'));
  lines.push('');
  lines.push(escposPlainLineCenter(paper, 'THANK YOU AND COME AGAIN'));
  lines.push(escposPlainLineCenter(paper, 'Total items: 3'));
  lines.push('');
  lines.push(escposPlainLineCenter(paper, 'OK — ' + paper));
  for (let i = 0; i < 10; i += 1) lines.push('');
  return lines.join('\n');
}
