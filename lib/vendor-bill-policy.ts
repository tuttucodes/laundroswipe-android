/** Vendors may cancel/delete or edit a bill only within this window from creation. */
export const VENDOR_BILL_CANCEL_EDIT_WINDOW_MS = 60 * 60 * 1000;

export function isWithinVendorBillCancelEditWindow(createdAtIso: string): boolean {
  const t = new Date(createdAtIso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= VENDOR_BILL_CANCEL_EDIT_WINDOW_MS;
}
