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
  showReceiptPreview: boolean;
  printTimeoutMs: number;
  /** Optional UPI / payment string for QR on receipt */
  paymentQrPayload: string;
  showPaymentQr: boolean;
}

const KEY = 'laundroswipe_ble_printer_prefs_v1';

const defaults: BlePrinterPreferences = {
  preferBluetoothEscPos: true,
  paperSize: '80mm',
  printDensity: 'medium',
  autoConnect: true,
  showReceiptPreview: false,
  printTimeoutMs: 15000,
  paymentQrPayload: '',
  showPaymentQr: false,
};

function load(): BlePrinterPreferences {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Partial<BlePrinterPreferences>;
    return {
      ...defaults,
      ...p,
      paperSize: p.paperSize === '58mm' || p.paperSize === '76mm' || p.paperSize === '80mm' ? p.paperSize : defaults.paperSize,
      printDensity:
        p.printDensity === 'light' || p.printDensity === 'medium' || p.printDensity === 'dark'
          ? p.printDensity
          : defaults.printDensity,
      printTimeoutMs: typeof p.printTimeoutMs === 'number' && p.printTimeoutMs >= 5000 ? p.printTimeoutMs : defaults.printTimeoutMs,
      paymentQrPayload: typeof p.paymentQrPayload === 'string' ? p.paymentQrPayload : '',
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

/** Paper width for ESC/POS receipts (Bluetooth path). */
export function getEffectiveEscPosPaperSize(): PaperSize {
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
