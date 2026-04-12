/**
 * Web Bluetooth ESC/POS preferences (vendor POS). Separate from paper model list in printer-settings.
 */

import type { PaperSize } from '@/lib/printing/escpos/ESCPOSBuilder';
import { paperSizeFromCharsPerLine } from '@/lib/printing/escpos/ESCPOSBuilder';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';

export type BlePrintDensity = 'light' | 'medium' | 'dark';

export interface BlePrinterPreferences {
  /** When true, try raw ESC/POS over BLE before the system print dialog. */
  preferBluetoothEscPos: boolean;
  /** Stored paper width for ESC/POS layout. */
  paperSize: PaperSize;
  printDensity: BlePrintDensity;
  /** Reconnect to last BLE printer on load (getDevices + connect). */
  autoConnect: boolean;
  printTimeoutMs: number;
  /** Optional UPI / payment string for QR on receipt */
  paymentQrPayload: string;
  showPaymentQr: boolean;
}

const KEY = 'laundroswipe_ble_printer_prefs_v1';

const defaults: BlePrinterPreferences = {
  preferBluetoothEscPos: true,
  paperSize: '78mm',
  printDensity: 'medium',
  autoConnect: true,
  printTimeoutMs: 15000,
  paymentQrPayload: '',
  showPaymentQr: false,
};

function load(): BlePrinterPreferences {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Partial<BlePrinterPreferences> & Record<string, unknown>;
    return {
      preferBluetoothEscPos: typeof p.preferBluetoothEscPos === 'boolean' ? p.preferBluetoothEscPos : defaults.preferBluetoothEscPos,
      paperSize:
        p.paperSize === '58mm' || p.paperSize === '76mm' || p.paperSize === '78mm' || p.paperSize === '80mm'
          ? p.paperSize
          : defaults.paperSize,
      printDensity:
        p.printDensity === 'light' || p.printDensity === 'medium' || p.printDensity === 'dark'
          ? p.printDensity
          : defaults.printDensity,
      autoConnect: typeof p.autoConnect === 'boolean' ? p.autoConnect : defaults.autoConnect,
      printTimeoutMs: typeof p.printTimeoutMs === 'number' && p.printTimeoutMs >= 5000 ? p.printTimeoutMs : defaults.printTimeoutMs,
      paymentQrPayload: typeof p.paymentQrPayload === 'string' ? p.paymentQrPayload : '',
      showPaymentQr: typeof p.showPaymentQr === 'boolean' ? p.showPaymentQr : defaults.showPaymentQr,
    };
  } catch {
    return defaults;
  }
}

function save(p: BlePrinterPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* */
  }
}

export function getBlePrinterPreferences(): BlePrinterPreferences {
  return load();
}

export function setBlePrinterPreferences(patch: Partial<BlePrinterPreferences>): BlePrinterPreferences {
  const next = { ...load(), ...patch };
  save(next);
  return next;
}

/**
 * Paper width for ESC/POS receipts. Prefer Admin → Printers default model `charsPerLine`
 * so layout matches the 78mm / 3" dialog width; fall back to saved BLE preference.
 */
export function getEffectiveEscPosPaperSize(): PaperSize {
  if (typeof window !== 'undefined') {
    const cfg = getPrinterConfigForPrint();
    if (cfg?.charsPerLine && cfg.charsPerLine > 0) {
      return paperSizeFromCharsPerLine(cfg.charsPerLine);
    }
  }
  return load().paperSize;
}

/** Map Admin → Printers default model chars/line to 58/76/80mm and save. */
export function syncEscPosPaperFromAdminPrinter(): PaperSize | null {
  const cfg = getPrinterConfigForPrint();
  if (!cfg?.charsPerLine) return null;
  const paperSize = paperSizeFromCharsPerLine(cfg.charsPerLine);
  setBlePrinterPreferences({ paperSize });
  return paperSize;
}
