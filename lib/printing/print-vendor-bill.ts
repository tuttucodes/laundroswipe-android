import { LSApi } from '@/lib/api';
import type { VendorBillRow } from '@/lib/api';
import { vendorBillRowToThermalReceiptData } from './receipt/thermalReceiptTypes';
import { buildVendorReceiptEscPos } from './receipt/vendorReceipt';
import type { PaperSize } from './escpos/ESCPOSBuilder';

type PrintFn = (
  bytes: Uint8Array,
) => Promise<{ ok: true } | { ok: false; error: string }>;

export type PrintVendorBillResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Fetch bill detail (line items + customer info) and emit ESC/POS receipt
 * via the supplied bluetooth print function.
 */
export async function printVendorBillById(
  billId: string,
  paper: PaperSize,
  print: PrintFn,
): Promise<PrintVendorBillResult> {
  let bill: VendorBillRow | null = null;
  try {
    bill = await LSApi.fetchVendorBillById(billId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!bill) return { ok: false, error: 'Bill not found.' };
  return printVendorBillRow(bill, paper, print);
}

export async function printVendorBillRow(
  bill: VendorBillRow,
  paper: PaperSize,
  print: PrintFn,
): Promise<PrintVendorBillResult> {
  const data = vendorBillRowToThermalReceiptData(bill);
  const bytes = buildVendorReceiptEscPos(paper, {
    vendorName: data.subtitle ?? 'LaundroSwipe',
    tokenLabel: data.token,
    orderLabel: data.orderId,
    customerLabel: data.customer.name,
    phoneLabel: data.customer.phone,
    customerDisplayId: data.customerId,
    regNo: data.customer.regNo,
    hostelBlock: bill.customer_hostel_block ?? undefined,
    roomNumber: bill.customer_room_number ?? undefined,
    dateStr: data.dateTime,
    lineItems: data.items.map((i) => ({ label: i.name, qty: i.qty, price: i.rate })),
    totalItems: data.items.reduce((s, i) => s + i.qty, 0),
    subtotal: Number(bill.subtotal ?? 0),
    serviceFeeLine: `Service fee: Rs.${Number(bill.convenience_fee ?? 0).toFixed(2)}`,
    total: Number(bill.total ?? data.total ?? 0),
    footer: data.footer,
  });
  return await print(bytes);
}
