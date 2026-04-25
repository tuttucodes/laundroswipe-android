import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { VendorBillRow } from '@/lib/api';
import { renderThermalReceiptHtml } from './receipt/vendorReceiptHtml';
import { vendorBillRowToThermalReceiptData } from './receipt/thermalReceiptTypes';

export async function shareBillPdf(
  bill: VendorBillRow,
): Promise<{ ok: true; uri: string } | { ok: false; error: string }> {
  try {
    const html = renderThermalReceiptHtml(vendorBillRowToThermalReceiptData(bill));
    const { uri } = await Print.printToFileAsync({
      html,
      width: 226, // 80mm in points (1mm ≈ 2.83pt) — keeps thermal proportions
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Bill #${bill.order_token}`,
      });
    } else {
      await Print.printAsync({ uri });
    }
    return { ok: true, uri };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
