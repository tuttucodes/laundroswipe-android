import { getEffectiveEscPosPaperSize } from '@/lib/ble-printer-settings';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';
import type { PaperSize } from './escpos/ESCPOSBuilder';
import { buildVendorReceiptEscPos, formatVendorReceiptEscPosPlain, type VendorReceiptInput } from './receipt/vendorReceipt';

/**
 * One pipeline for every vendor bill: ESC/POS bytes, plain text, and chars-per-line
 * (used for HTML `<pre>` width). Always use this for Print bill / Copy receipt so output
 * matches `lib/printing/receipt/vendorReceipt.ts`.
 */
export type VendorBillPrintPayload = {
  paper: PaperSize;
  escPosPayload: Uint8Array;
  plain: string;
  charsPerLine: number;
  printer: ReturnType<typeof getPrinterConfigForPrint> | undefined;
};

export function buildVendorBillPrintPayload(input: VendorReceiptInput): VendorBillPrintPayload {
  const paper = getEffectiveEscPosPaperSize();
  const escPosPayload = buildVendorReceiptEscPos(paper, input);
  const plain = formatVendorReceiptEscPosPlain(paper, input);
  const config = getPrinterConfigForPrint();
  const charsPerLine = config?.charsPerLine ?? 46;
  return {
    paper,
    escPosPayload,
    plain,
    charsPerLine,
    printer: config ?? undefined,
  };
}
