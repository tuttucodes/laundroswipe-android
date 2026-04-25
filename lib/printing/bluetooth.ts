import { PermissionsAndroid, Platform } from 'react-native';
import type { PairedPrinter } from './bluetooth-types';

export type { PairedPrinter };

/**
 * Cross-platform ESC/POS printing surface.
 *
 *  - Android: classic SPP via react-native-bluetooth-classic (paired devices).
 *  - iOS: BLE GATT writes via react-native-ble-plx (scanned devices).
 */

type RNBluetoothClassicShape = {
  isBluetoothEnabled(): Promise<boolean>;
  requestBluetoothEnabled(): Promise<boolean>;
  getBondedDevices(): Promise<
    Array<{
      address: string;
      name: string | null;
      isConnected(): Promise<boolean>;
      connect(opts?: Record<string, unknown>): Promise<unknown>;
      write(data: string, encoding?: string): Promise<unknown>;
      disconnect(): Promise<unknown>;
    }>
  >;
};

let classicRef: RNBluetoothClassicShape | null | undefined;
function loadClassic(): RNBluetoothClassicShape | null {
  if (classicRef !== undefined) return classicRef;
  try {
    const mod = require('react-native-bluetooth-classic');
    classicRef = (mod?.default ?? mod) as RNBluetoothClassicShape;
  } catch {
    classicRef = null;
  }
  return classicRef;
}

type IosImpl = typeof import('./bluetooth-ios');
let iosRef: IosImpl | null | undefined;
function loadIos(): IosImpl | null {
  if (iosRef !== undefined) return iosRef;
  try {
    iosRef = require('./bluetooth-ios') as IosImpl;
  } catch {
    iosRef = null;
  }
  return iosRef;
}

export function bluetoothAvailable(): boolean {
  if (Platform.OS === 'android') return !!loadClassic();
  if (Platform.OS === 'ios') return !!loadIos();
  return false;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return globalThis.btoa(binary);
}

export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
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
  if (Platform.OS === 'ios') {
    const ios = loadIos();
    if (!ios) return false;
    try {
      return await ios.ensureBluetoothEnabled();
    } catch {
      return false;
    }
  }
  const native = loadClassic();
  if (!native) return false;
  try {
    return await native.isBluetoothEnabled();
  } catch {
    return false;
  }
}

export async function enableBluetoothIfNeeded(): Promise<boolean> {
  if (Platform.OS === 'ios') return await isBluetoothEnabled();
  const native = loadClassic();
  if (!native) return false;
  if (await isBluetoothEnabled()) return true;
  try {
    return await native.requestBluetoothEnabled();
  } catch {
    return false;
  }
}

/**
 * Android: returns paired (bonded) printers.
 * iOS: scans nearby BLE devices that look like printers (~6s).
 */
export async function listPairedPrinters(): Promise<PairedPrinter[]> {
  if (Platform.OS === 'ios') {
    const ios = loadIos();
    if (!ios) {
      throw new Error('Bluetooth printing requires a dev/production build (not Expo Go).');
    }
    return await ios.scanForPrinters();
  }
  const native = loadClassic();
  if (!native) {
    throw new Error('Bluetooth printing requires a dev/production build (not Expo Go).');
  }
  const ok = await ensureBluetoothPermissions();
  if (!ok) throw new Error('Bluetooth permission denied.');
  const devices = await native.getBondedDevices();
  return devices.map((d) => ({ address: d.address, name: d.name ?? null }));
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
  if (Platform.OS === 'ios') {
    const ios = loadIos();
    if (!ios) {
      throw new Error('Bluetooth printing requires a dev/production build (not Expo Go).');
    }
    if (!(await isBluetoothEnabled())) {
      throw new Error('Bluetooth is off. Turn it on and try again.');
    }
    await ios.writeEscPosBytesIos(address, bytes);
    return;
  }
  const native = loadClassic();
  if (!native) {
    throw new Error('Bluetooth printing requires a dev/production build (not Expo Go).');
  }
  const ok = await ensureBluetoothPermissions();
  if (!ok) throw new Error('Bluetooth permission denied.');
  if (!(await isBluetoothEnabled())) {
    throw new Error('Bluetooth is off. Turn it on and try again.');
  }
  let device: Awaited<ReturnType<RNBluetoothClassicShape['getBondedDevices']>>[number] | null =
    null;
  try {
    const bonded = await native.getBondedDevices();
    device = bonded.find((d) => d.address === address) ?? null;
    if (!device) {
      throw new Error(`Printer ${address} not paired. Pair in Android Bluetooth settings.`);
    }

    const connected = await device.isConnected();
    if (!connected) {
      await device.connect({ delimiter: '\n', charset: 'utf-8' });
    }
    const payload = uint8ToBase64(bytes);
    await device.write(payload, 'base64');
  } finally {
    try {
      if (device) {
        const stillConnected = await device.isConnected();
        if (stillConnected) await device.disconnect();
      }
    } catch {
      /* ignore disconnect failures */
    }
  }
}
