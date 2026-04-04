/**
 * Web Bluetooth (BLE) thermal printer connection.
 * Classic Bluetooth SPP is not available in the browser — document in UI.
 */

export const BLE_OPTIONAL_SERVICES: string[] = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

const STORAGE_DEVICE_ID = 'laundroswipe_ble_printer_device_id';

type GattChar = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(buffer: ArrayBufferView): Promise<void>;
  writeValueWithoutResponse?(buffer: ArrayBufferView): Promise<void>;
};

type GattService = {
  getCharacteristics(): Promise<GattChar[]>;
};

type GattServer = {
  connected: boolean;
  disconnect(): void;
  getPrimaryService(service: string): Promise<GattService>;
  getPrimaryServices(): Promise<GattService[]>;
};

type BTDevice = {
  id: string;
  name?: string;
  gatt?: { connect(): Promise<GattServer> };
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
  removeEventListener(type: 'gattserverdisconnected', listener: () => void): void;
};

type BluetoothNS = {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: Array<{ services?: string[] }>;
    optionalServices?: string[];
  }): Promise<BTDevice>;
  getDevices?: () => Promise<BTDevice[]>;
};

function getBluetooth(): BluetoothNS | null {
  if (typeof navigator === 'undefined') return null;
  const b = (navigator as unknown as { bluetooth?: BluetoothNS }).bluetooth;
  return b ?? null;
}

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!getBluetooth()?.requestDevice;
}

async function pickWritableCharacteristic(server: GattServer): Promise<GattChar | null> {
  for (const sid of BLE_OPTIONAL_SERVICES) {
    try {
      const svc = await server.getPrimaryService(sid);
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) return c;
      }
    } catch {
      /* try next */
    }
  }
  try {
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      let chars: GattChar[];
      try {
        chars = await svc.getCharacteristics();
      } catch {
        continue;
      }
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) return c;
      }
    }
  } catch {
    /* */
  }
  return null;
}

async function writeChunks(char: GattChar, data: Uint8Array): Promise<void> {
  const chunkSizes = [512, 180, 20];
  let lastErr: unknown;
  for (const size of chunkSizes) {
    try {
      for (let i = 0; i < data.length; i += size) {
        const chunk = data.subarray(i, Math.min(i + size, data.length));
        const wnr = char.writeValueWithoutResponse?.bind(char);
        if (char.properties.writeWithoutResponse && wnr) {
          await wnr(chunk);
        } else {
          await char.writeValue(chunk);
        }
        if (size <= 20 && chunk.length > 0) {
          await new Promise((r) => setTimeout(r, 15));
        }
      }
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export type BleConnectionState = 'disconnected' | 'connecting' | 'connected';

export class BluetoothPrinterService {
  private static instance: BluetoothPrinterService | null = null;

  static getInstance(): BluetoothPrinterService {
    if (!BluetoothPrinterService.instance) {
      BluetoothPrinterService.instance = new BluetoothPrinterService();
    }
    return BluetoothPrinterService.instance;
  }

  private device: BTDevice | null = null;
  private server: GattServer | null = null;
  private char: GattChar | null = null;
  private state: BleConnectionState = 'disconnected';
  private subs = new Set<(s: BleConnectionState) => void>();
  private onDisc: (() => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private autoReconnectEnabled = true;
  private maxAutoReconnect = 5;

  subscribe(fn: (s: BleConnectionState) => void): () => void {
    this.subs.add(fn);
    fn(this.state);
    return () => {
      this.subs.delete(fn);
    };
  }

  private setState(s: BleConnectionState) {
    this.state = s;
    this.subs.forEach((fn) => fn(s));
  }

  getConnectionState(): BleConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected' && !!this.char && !!this.server?.connected;
  }

  getLastDeviceId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STORAGE_DEVICE_ID);
  }

  setAutoReconnect(enabled: boolean) {
    this.autoReconnectEnabled = enabled;
    if (!enabled && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private persistDeviceId(id: string) {
    try {
      localStorage.setItem(STORAGE_DEVICE_ID, id);
    } catch {
      /* */
    }
  }

  clearStoredDevice() {
    try {
      localStorage.removeItem(STORAGE_DEVICE_ID);
    } catch {
      /* */
    }
  }

  private detachDeviceListener() {
    if (this.device && this.onDisc) {
      this.device.removeEventListener('gattserverdisconnected', this.onDisc);
    }
    this.onDisc = null;
  }

  private attachDeviceListener(dev: BTDevice) {
    this.detachDeviceListener();
    this.onDisc = () => {
      this.char = null;
      this.server = null;
      this.setState('disconnected');
      this.scheduleReconnect();
    };
    dev.addEventListener('gattserverdisconnected', this.onDisc);
  }

  private scheduleReconnect() {
    if (!this.autoReconnectEnabled) return;
    const id = this.getLastDeviceId();
    if (!id) return;
    if (this.reconnectAttempts >= this.maxAutoReconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnectFromStorage().catch(() => {
        this.reconnectAttempts += 1;
        this.scheduleReconnect();
      });
    }, delay);
  }

  async pickAndConnect(): Promise<void> {
    const bt = getBluetooth();
    if (!bt?.requestDevice) {
      throw new Error('Web Bluetooth is not available in this browser. Use Chrome on Android or enable Bluetooth in WebView flags.');
    }
    this.setState('connecting');
    this.reconnectAttempts = 0;
    try {
      const dev = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [...BLE_OPTIONAL_SERVICES],
      });
      await this.connectDevice(dev);
      this.persistDeviceId(dev.id);
    } catch (e) {
      this.setState('disconnected');
      throw e;
    }
  }

  async reconnectFromStorage(): Promise<boolean> {
    const bt = getBluetooth();
    if (!bt?.getDevices) return false;
    const id = this.getLastDeviceId();
    if (!id) return false;
    if (this.isConnected()) return true;
    this.setState('connecting');
    try {
      const list = await bt.getDevices();
      const dev = list.find((d) => d.id === id);
      if (!dev) {
        this.setState('disconnected');
        return false;
      }
      await this.connectDevice(dev);
      this.reconnectAttempts = 0;
      return true;
    } catch {
      this.setState('disconnected');
      return false;
    }
  }

  private async connectDevice(dev: BTDevice): Promise<void> {
    this.detachDeviceListener();
    this.device = dev;
    this.attachDeviceListener(dev);
    if (!dev.gatt) {
      this.setState('disconnected');
      throw new Error('GATT not available on this device');
    }
    const server = await dev.gatt.connect();
    this.server = server;
    const ch = await pickWritableCharacteristic(server);
    if (!ch) {
      try {
        server.disconnect();
      } catch {
        /* */
      }
      this.setState('disconnected');
      throw new Error('No writable GATT characteristic found. This printer may use Classic Bluetooth (SPP) only — Web Bluetooth cannot use SPP.');
    }
    this.char = ch;
    this.setState('connected');
  }

  disconnectUser() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.detachDeviceListener();
    try {
      this.server?.disconnect();
    } catch {
      /* */
    }
    this.server = null;
    this.char = null;
    this.device = null;
    this.setState('disconnected');
  }

  async writeRaw(data: Uint8Array): Promise<void> {
    if (!this.char || !this.isConnected()) {
      throw new Error('Bluetooth printer not connected');
    }
    await writeChunks(this.char, data);
  }
}
