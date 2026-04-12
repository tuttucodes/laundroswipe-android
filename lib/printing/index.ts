import { tryNativeEscPosPrint } from '@/lib/native-print-bridge';
import { BluetoothPrinterService, isWebBluetoothAvailable } from './bluetooth/BluetoothPrinterService';
import { PrintQueue } from './queue/PrintQueue';
import { type PaperSize } from './escpos/ESCPOSBuilder';
import { getBlePrinterPreferences } from '@/lib/ble-printer-settings';
import {
  buildVendorReceiptEscPos,
  formatVendorReceiptEscPosPlain,
  type VendorReceiptInput,
} from './receipt/vendorReceipt';

export type { PaperSize } from './escpos/ESCPOSBuilder';
export {
  ESCPOSBuilder,
  paperSizeFromCharsPerLine,
  escposPlainDivider,
  escposPlainTableRow,
  escposPlainLineRight,
  escposPlainLineCenter,
  escposTableColumnWidths,
  PAPER_FONT_A_CHARS,
} from './escpos/ESCPOSBuilder';
export {
  buildVendorReceiptEscPos,
  formatVendorReceiptEscPosPlain,
  savedVendorBillToReceiptInput,
  type VendorReceiptInput,
  type VendorReceiptLine,
} from './receipt/vendorReceipt';
export { buildVendorBillPrintPayload, type VendorBillPrintPayload } from './vendorBillPrintPayload';
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

function testVendorReceiptInput(paper: PaperSize): VendorReceiptInput {
  return {
    vendorName: 'LaundroSwipe',
    tagline: 'Printer test',
    tokenLabel: 'SAMPLE',
    orderLabel: 'TEST-001',
    customerLabel: 'Test customer',
    phoneLabel: '9999999999',
    customerDisplayId: 'LS-0000',
    customerEmail: 'test@example.com',
    dateStr: new Date().toLocaleString(),
    lineItems: [
      { label: 'Wash & fold', qty: 2, price: 60 },
      { label: 'Iron', qty: 1, price: 45 },
    ],
    totalItems: 3,
    subtotal: 165,
    convenienceFee: 0,
    convenienceFeeOriginal: 10,
    total: 165,
    footer: `OK — ${paper}`,
  };
}

/** Small test ticket — same layout as live vendor bills. */
export function buildTestEscPosReceipt(paper: PaperSize): Uint8Array {
  return buildVendorReceiptEscPos(paper, testVendorReceiptInput(paper));
}

/** Plain-text mirror of `buildTestEscPosReceipt` (browser print + byte fallback). */
export function formatTestEscPosPlain(paper: PaperSize): string {
  return formatVendorReceiptEscPosPlain(paper, testVendorReceiptInput(paper));
}
