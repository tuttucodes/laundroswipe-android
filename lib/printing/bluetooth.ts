import { PermissionsAndroid, Platform } from 'react-native';
import type { PairedPrinter } from './bluetooth-types';

export type { PairedPrinter };

/**
 * Cross-platform ESC/POS printing surface (BLE GATT for Android + iOS).
 *
 * Backed by react-native-ble-plx (New-Architecture compatible). Modern thermal
 * printers expose ESC/POS over BLE — we scan, filter by name heuristic, let the
 * user pick one, then chunk-write bytes to a known writable characteristic.
 */

type IosImpl = typeof import('./bluetooth-ios');
let iosRef: IosImpl | null | undefined;
function loadBleModule(): IosImpl | null {
  if (iosRef !== undefined) return iosRef;
  try {
    iosRef = require('./bluetooth-ios') as IosImpl;
  } catch {
    iosRef = null;
  }
  return iosRef;
}

export function bluetoothAvailable(): boolean {
  return !!loadBleModule();
}

export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10);
  if (apiLevel >= 31) {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ]);
    return (
      res['android.permission.BLUETOOTH_CONNECT'] === 'granted' &&
      res['android.permission.BLUETOOTH_SCAN'] === 'granted'
    );
  }
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return fine === 'granted';
}

export async function isBluetoothEnabled(): Promise<boolean> {
  const ble = loadBleModule();
  if (!ble) return false;
  try {
    return await ble.ensureBluetoothEnabled();
  } catch {
    return false;
  }
}

export async function enableBluetoothIfNeeded(): Promise<boolean> {
  return await isBluetoothEnabled();
}

/**
 * Scan for nearby BLE thermal printers (~6s) and return what looks like a printer.
 * On Android we also request runtime BT permissions before scanning.
 */
export async function listPairedPrinters(): Promise<PairedPrinter[]> {
  const ble = loadBleModule();
  if (!ble) {
    throw new Error('Bluetooth printing requires a dev/production build (not Expo Go).');
  }
  if (Platform.OS === 'android') {
    const ok = await ensureBluetoothPermissions();
    if (!ok) throw new Error('Bluetooth permission denied.');
  }
  return await ble.scanForPrinters();
}

const PRINTER_HINTS = ['print', 'pos', 'thermal', 'tm-', 'rp', 'mtp', 'sprt', 'gprt', 'mpt', 'bt-'];

export function rankPrinterFirst(devices: PairedPrinter[]): PairedPrinter[] {
  return [...devices].sort((a, b) => {
    const an = (a.name ?? '').toLowerCase();
    const bn = (b.name ?? '').toLowerCase();
    const ah = PRINTER_HINTS.some((h) => an.includes(h)) ? 0 : 1;
    const bh = PRINTER_HINTS.some((h) => bn.includes(h)) ? 0 : 1;
    return ah - bh;
  });
}

export async function printEscPosBytes(address: string, bytes: Uint8Array): Promise<void> {
  const ble = loadBleModule();
  if (!ble) {
    throw new Error('Bluetooth printing requires a dev/production build (not Expo Go).');
  }
  if (Platform.OS === 'android') {
    const ok = await ensureBluetoothPermissions();
    if (!ok) throw new Error('Bluetooth permission denied.');
  }
  if (!(await isBluetoothEnabled())) {
    throw new Error('Bluetooth is off. Turn it on and try again.');
  }
  await ble.writeEscPosBytesIos(address, bytes);
}
