/**
 * Open a print dialog for 2" (58mm) Bluetooth thermal receipt printers.
 * Uses window.open + simple HTML/CSS for maximum compatibility with older Android
 * devices and Bluetooth POS thermal printers.
 *
 * Paper: 58mm width (2" thermal roll). Print area ~48mm; layout kept within 58mm.
 */
const THERMAL_STYLES = `
*{margin:0;padding:0}
html,body{width:58mm;max-width:58mm;min-width:58mm;font-family:'Courier New',Courier,monospace;font-size:10px;line-height:1.35;padding:3mm;margin:0;background:#fff;color:#000}
body{overflow:visible}
.receipt{width:58mm;max-width:58mm}
h2{text-align:center;font-size:11px;font-weight:700;margin:0 0 1mm}
.meta{text-align:center;font-size:9px;margin:0 0 2mm}
p{margin:1mm 0;font-size:9px;word-break:break-word}
table{width:100%;border-collapse:collapse;font-size:9px;margin:2mm 0}
th,td{padding:1mm 0;border-bottom:1px dotted #000}
th{text-align:left;font-weight:700}
.right{text-align:right}
.total{border-top:2px solid #000;font-weight:700;font-size:10px;padding-top:2mm;margin-top:2mm}
.conv{font-size:8px}
.foot{text-align:center;margin-top:3mm;font-size:9px}
@media print{
  html,body{width:58mm!important;max-width:58mm!important;min-width:58mm!important;padding:0!important;margin:0!important;background:#fff!important}
  @page{size:58mm auto;margin:2mm}
}
`;

/**
 * Opens a new window with the receipt HTML and triggers print after a short delay
 * so older Android devices have time to render. User selects Bluetooth thermal
 * printer in the system print dialog.
 */
export function printThermalReceipt(title: string, bodyHtml: string): boolean {
  const w = window.open('', '_blank', 'width=320,height=480,menubar=no,toolbar=no');
  if (!w) return false;
  const doc = w.document;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' + THERMAL_STYLES + '</style></head><body><div class="receipt">' +
      bodyHtml +
      '</div></body></html>'
  );
  doc.close();
  w.focus();
  // Delay so old Android WebView finishes layout before print dialog
  setTimeout(() => {
    try {
      w.print();
    } catch (_) {
      // ignore
    }
    // Close after print dialog dismisses; user may need to select Bluetooth printer
    setTimeout(() => w.close(), 500);
  }, 600);
  return true;
}

function escapeHtml(s: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = s;
    return div.innerHTML;
  }
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
