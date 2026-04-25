import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaperSize } from './escpos/ESCPOSBuilder';

export type PrintDensity = 'light' | 'medium' | 'dark';

export type BluetoothPrinterPrefs = {
  mac: string | null;
  name: string | null;
  paper: PaperSize;
  printDensity: PrintDensity;
};

const KEY = 'ls.printer.prefs.v1';

const DEFAULTS: BluetoothPrinterPrefs = {
  mac: null,
  name: null,
  paper: '80mm',
  printDensity: 'medium',
};

let cache: BluetoothPrinterPrefs | null = null;

export async function loadPrinterPrefs(): Promise<BluetoothPrinterPrefs> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BluetoothPrinterPrefs>;
      cache = { ...DEFAULTS, ...parsed };
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = { ...DEFAULTS };
  return cache;
}

export async function savePrinterPrefs(
  p: Partial<BluetoothPrinterPrefs>,
): Promise<BluetoothPrinterPrefs> {
  const cur = await loadPrinterPrefs();
  cache = { ...cur, ...p };
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  return cache;
}

export function getPrinterPrefsSync(): BluetoothPrinterPrefs {
  return cache ?? { ...DEFAULTS };
}
