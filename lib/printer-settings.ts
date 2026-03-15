/**
 * Printer models and saved printer settings (admin).
 * Stored in localStorage so the same device uses the chosen printer for receipts.
 */

export type PrinterModelId = 'generic-58' | 'epson-m80';

export interface PrinterModel {
  id: PrinterModelId;
  name: string;
  paperWidthMm: number;
  charsPerLine: number;
  description?: string;
}

/** Known printer models (like "add printer" lists in other apps). */
export const PRINTER_MODELS: PrinterModel[] = [
  { id: 'generic-58', name: 'Generic 2" (58mm)', paperWidthMm: 58, charsPerLine: 32, description: 'Most Bluetooth thermal receipt printers' },
  { id: 'epson-m80', name: 'Epson M80 / TM-P80 (79mm)', paperWidthMm: 79, charsPerLine: 48, description: 'Epson TM-P80, TM-P80II; Bluetooth or USB' },
];

export interface SavedPrinter {
  id: string;
  modelId: PrinterModelId;
  name: string;
  isDefault: boolean;
  addedAt: string;
}

export interface PrinterSettings {
  printers: SavedPrinter[];
  defaultPrinterId: string | null;
}

const STORAGE_KEY = 'laundroswipe_printer_settings';

const defaultSettings: PrinterSettings = {
  printers: [],
  defaultPrinterId: null,
};

function load(): PrinterSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as PrinterSettings;
    if (!Array.isArray(parsed.printers)) parsed.printers = [];
    if (typeof parsed.defaultPrinterId !== 'string' && parsed.defaultPrinterId !== null) parsed.defaultPrinterId = null;
    return parsed;
  } catch {
    return defaultSettings;
  }
}

function save(settings: PrinterSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {}
}

export function getPrinterSettings(): PrinterSettings {
  return load();
}

export function getDefaultPrinter(): SavedPrinter | null {
  const s = load();
  if (!s.defaultPrinterId) return null;
  return s.printers.find((p) => p.id === s.defaultPrinterId) ?? null;
}

export function getPrinterConfigForPrint(): { paperWidthMm: number; charsPerLine: number } | null {
  const def = getDefaultPrinter();
  if (!def) return null;
  const model = PRINTER_MODELS.find((m) => m.id === def.modelId);
  if (!model) return null;
  return { paperWidthMm: model.paperWidthMm, charsPerLine: model.charsPerLine };
}

/** Add a new printer (model + display name). */
export function addPrinter(modelId: PrinterModelId, name: string): SavedPrinter {
  const settings = load();
  const model = PRINTER_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error('Unknown printer model');
  const id = `printer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const isDefault = settings.printers.length === 0;
  const printer: SavedPrinter = {
    id,
    modelId,
    name: name.trim() || model.name,
    isDefault,
    addedAt: new Date().toISOString(),
  };
  const printers = settings.printers.map((p) => ({ ...p, isDefault: false }));
  printers.push(printer);
  const newSettings: PrinterSettings = {
    printers,
    defaultPrinterId: isDefault ? id : settings.defaultPrinterId,
  };
  save(newSettings);
  return printer;
}

/** Remove a printer. */
export function removePrinter(printerId: string): void {
  const settings = load();
  const printers = settings.printers.filter((p) => p.id !== printerId);
  const defaultPrinterId =
    settings.defaultPrinterId === printerId
      ? printers[0]?.id ?? null
      : settings.defaultPrinterId;
  save({ printers, defaultPrinterId });
}

/** Set default printer for receipts. */
export function setDefaultPrinter(printerId: string): void {
  const settings = load();
  if (!settings.printers.some((p) => p.id === printerId)) return;
  const printers = settings.printers.map((p) => ({ ...p, isDefault: p.id === printerId }));
  save({ printers, defaultPrinterId: printerId });
}

/** Update display name of a printer. */
export function updatePrinterName(printerId: string, name: string): void {
  const settings = load();
  const printers = settings.printers.map((p) =>
    p.id === printerId ? { ...p, name: name.trim() || p.name } : p
  );
  save({ ...settings, printers });
}
