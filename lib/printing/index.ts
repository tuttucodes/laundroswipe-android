import { BluetoothPrinterService, isWebBluetoothAvailable } from './bluetooth/BluetoothPrinterService';
import { PrintQueue } from './queue/PrintQueue';
import { ESCPOSBuilder, type PaperSize } from './escpos/ESCPOSBuilder';
import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';

export type { PaperSize } from './escpos/ESCPOSBuilder';
export { ESCPOSBuilder, paperSizeFromCharsPerLine } from './escpos/ESCPOSBuilder';
export {
  buildVendorReceiptEscPos,
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

export type BluetoothPrintResult = 'printed' | 'not-connected' | 'unavailable' | 'disabled' | 'error';

/**
 * Send raw ESC/POS to the connected BLE printer with queue + timeout.
 */
export async function printEscPosViaBluetooth(bytes: Uint8Array): Promise<BluetoothPrintResult> {
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
