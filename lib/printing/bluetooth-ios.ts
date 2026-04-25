/**
 * iOS Bluetooth printing via BLE (react-native-ble-plx).
 *
 * iOS does not expose "paired classic devices" the way Android does. We scan,
 * filter for printers by name heuristic, let the user pick one, then write
 * ESC/POS bytes to a known writable characteristic.
 *
 * Supported printer GATT profiles (most generic ESC/POS BLE thermal printers):
 *   - Service `49535343-FE7D-4AE5-8FA9-9FAFD205E455` / Char `49535343-8841-43F4-A8D4-ECBE34729BB3`
 *   - Service `0000FFE0-0000-1000-8000-00805F9B34FB` / Char `0000FFE1-0000-1000-8000-00805F9B34FB`
 *   - Service `000018F0-0000-1000-8000-00805F9B34FB` / Char `00002AF1-0000-1000-8000-00805F9B34FB`
 */

import { BleManager, type Device, State } from 'react-native-ble-plx';
import type { PairedPrinter } from './bluetooth-types';

const KNOWN_PROFILES: ReadonlyArray<{ service: string; characteristic: string }> = [
  {
    service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    characteristic: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  },
  {
    service: '0000ffe0-0000-1000-8000-00805f9b34fb',
    characteristic: '0000ffe1-0000-1000-8000-00805f9b34fb',
  },
  {
    service: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
  },
];

const PRINTER_NAME_HINTS = [
  'print',
  'pos',
  'thermal',
  'tm-',
  'rp',
  'mtp',
  'sprt',
  'gprt',
  'mpt',
  'bt-',
];

let manager: BleManager | null = null;
function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
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

export async function ensureBluetoothEnabled(): Promise<boolean> {
  const m = getManager();
  const state = await m.state();
  return state === State.PoweredOn;
}

export async function scanForPrinters(timeoutMs = 6000): Promise<PairedPrinter[]> {
  const m = getManager();
  const state = await m.state();
  if (state !== State.PoweredOn) {
    throw new Error('Turn on Bluetooth and try again.');
  }
  const found = new Map<string, PairedPrinter>();
  return await new Promise<PairedPrinter[]>((resolve, reject) => {
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try {
        m.stopDeviceScan();
      } catch {
        /* ignore */
      }
      resolve(Array.from(found.values()));
    };
    m.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
      if (err) {
        stopped = true;
        reject(new Error(err.message));
        return;
      }
      if (!device) return;
      const name = device.name ?? device.localName ?? null;
      if (!name) return;
      const lc = name.toLowerCase();
      const looksLikePrinter = PRINTER_NAME_HINTS.some((h) => lc.includes(h));
      if (!looksLikePrinter) return;
      if (!found.has(device.id)) {
        found.set(device.id, { address: device.id, name });
      }
    });
    setTimeout(stop, timeoutMs);
  });
}

async function discoverWritableChar(
  device: Device,
): Promise<{ service: string; characteristic: string }> {
  await device.discoverAllServicesAndCharacteristics();
  const services = await device.services();
  for (const known of KNOWN_PROFILES) {
    const svc = services.find((s) => s.uuid.toLowerCase() === known.service);
    if (!svc) continue;
    const chars = await svc.characteristics();
    const c = chars.find((c) => c.uuid.toLowerCase() === known.characteristic);
    if (c && (c.isWritableWithResponse || c.isWritableWithoutResponse)) {
      return known;
    }
  }
  for (const svc of services) {
    const chars = await svc.characteristics();
    const c = chars.find((x) => x.isWritableWithoutResponse || x.isWritableWithResponse);
    if (c) return { service: svc.uuid, characteristic: c.uuid };
  }
  throw new Error('No writable Bluetooth characteristic on this printer.');
}

const CHUNK_BYTES = 180;

export async function writeEscPosBytesIos(deviceId: string, bytes: Uint8Array): Promise<void> {
  const m = getManager();
  const state = await m.state();
  if (state !== State.PoweredOn) {
    throw new Error('Bluetooth is off. Turn it on and try again.');
  }
  let device: Device | null = null;
  try {
    device = await m.connectToDevice(deviceId, { autoConnect: false, timeout: 8000 });
    const profile = await discoverWritableChar(device);
    for (let i = 0; i < bytes.length; i += CHUNK_BYTES) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK_BYTES, bytes.length));
      const b64 = uint8ToBase64(slice);
      await device.writeCharacteristicWithoutResponseForService(
        profile.service,
        profile.characteristic,
        b64,
      );
    }
  } finally {
    try {
      if (device) await device.cancelConnection();
    } catch {
      /* ignore */
    }
  }
}
