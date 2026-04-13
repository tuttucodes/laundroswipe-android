'use client';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThermalReceipt } from '@/components/receipt/ThermalReceipt';
import type { ThermalReceiptData } from '@/lib/receipt/thermalReceiptTypes';

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Opens a popup with the 80mm React thermal receipt and triggers the browser print dialog.
 * Use as `dialogFallbackRenderer` from `printThermalReceiptDirect`, or standalone from a button.
 */
export function openThermalReceiptReactPrintWindow(
  title: string,
  data: ThermalReceiptData,
  opts?: { autoPrintDelayMs?: number },
): boolean {
  const w = window.open('', '_blank', 'width=380,height=720,menubar=no,toolbar=no,scrollbars=yes');
  if (!w) return false;
  const delay = opts?.autoPrintDelayMs ?? 500;
  const doc = w.document;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"/>' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
      '<title>' +
      escapeHtml(title) +
      '</title><style>html,body{margin:0;background:#fff}</style></head><body><div id="thermal-rx-root"></div></body></html>',
  );
  doc.close();
  const el = doc.getElementById('thermal-rx-root');
  if (!el) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
    return false;
  }
  const root = createRoot(el);
  root.render(
    <StrictMode>
      <ThermalReceipt data={data} showPrintButton />
    </StrictMode>,
  );
  w.focus();
  if (delay >= 0) {
    w.setTimeout(() => {
      try {
        w.print();
      } catch {
        /* ignore */
      }
    }, delay);
  }
  return true;
}
