import type { PaperSize } from './printing/ESCPOSBuilder';

export type BlePrintDensity = 'light' | 'medium' | 'dark';

export function getBlePrinterPreferences(): {
  printDensity: BlePrintDensity;
  paperSize: PaperSize;
} {
  return { printDensity: 'medium', paperSize: '78mm' };
}
