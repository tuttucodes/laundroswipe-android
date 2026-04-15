import * as SecureStore from 'expo-secure-store';
import { formatVendorReceiptEscPosPlain, savedVendorBillToReceiptInput } from './printing/vendorReceipt';
import type { PaperSize } from './printing/ESCPOSBuilder';
import type { VendorBillRow } from './api-types';

const ADDR_KEY = 'laundroswipe_escpos_bt_address';

export type BtDeviceRow = { name: string; address: string };

export async function savePreferredPrinterAddress(address: string | null) {
  if (!address) await SecureStore.deleteItemAsync(ADDR_KEY);
  else await SecureStore.setItemAsync(ADDR_KEY, address);
}

export async function getPreferredPrinterAddress(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ADDR_KEY);
  } catch {
    return null;
  }
}

async function loadBluetoothModules(): Promise<{
  BluetoothManager: typeof import('react-native-bluetooth-escpos-printer').BluetoothManager;
  BluetoothEscposPrinter: typeof import('react-native-bluetooth-escpos-printer').BluetoothEscposPrinter;
}> {
  return await import('react-native-bluetooth-escpos-printer');
}

/** Paired + discovered devices (classic SPP). Requires dev build + Bluetooth permissions. */
export async function scanBluetoothDevices(): Promise<{ paired: BtDeviceRow[]; found: BtDeviceRow[] }> {
  const { BluetoothManager } = await loadBluetoothModules();
  await BluetoothManager.enableBluetooth();
  const raw = await BluetoothManager.scanDevices();
  const parsed = JSON.parse(raw) as { paired?: BtDeviceRow[]; found?: BtDeviceRow[] };
  return { paired: parsed.paired ?? [], found: parsed.found ?? [] };
}

export async function connectBluetoothPrinter(address: string): Promise<void> {
  const { BluetoothManager } = await loadBluetoothModules();
  await BluetoothManager.connect(address);
  await savePreferredPrinterAddress(address);
}

export async function printPlainLines(lines: string[]): Promise<void> {
  const { BluetoothEscposPrinter } = await loadBluetoothModules();
  await BluetoothEscposPrinter.printerInit();
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  for (const line of lines) {
    const safe = line.length ? `${line}` : ' ';
    await BluetoothEscposPrinter.printText(`${safe}\n\r`, { encoding: 'UTF-8', codepage: 0 });
  }
  await BluetoothEscposPrinter.printAndFeed(3);
}

export async function printVendorBillPlain(bill: VendorBillRow, paper: PaperSize = '78mm'): Promise<void> {
  const input = savedVendorBillToReceiptInput(bill);
  const body = formatVendorReceiptEscPosPlain(paper, input);
  const lines = body.split('\n');
  await printPlainLines(lines);
}

export async function printSelfTest(): Promise<void> {
  const { BluetoothEscposPrinter } = await loadBluetoothModules();
  await BluetoothEscposPrinter.printerInit();
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText('LaundroSwipe\n\r', { encoding: 'UTF-8', codepage: 0 });
  await BluetoothEscposPrinter.printText('Bluetooth test OK\n\r', { encoding: 'UTF-8', codepage: 0 });
  await BluetoothEscposPrinter.printAndFeed(5);
}
