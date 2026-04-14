'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PRINTER_MODELS,
  getPrinterSettings,
  addPrinter,
  removePrinter,
  setDefaultPrinter,
  setPreferPrintDialog,
  type PrinterModelId,
} from '@/lib/printer-settings';
import { buildTestEscPosReceipt, paperSizeFromCharsPerLine } from '@/lib/printing';
import { getThermalTestReceiptBodyHtml, getThermalTestReceiptPlainText, printThermalReceiptDirect } from '@/lib/thermal-print';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';

export default function AdminPrintersPage() {
  const [settings, setSettings] = useState(getPrinterSettings());
  const [adding, setAdding] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<PrinterModelId>('generic-68');
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [pairing, setPairing] = useState(false);

  const refresh = () => setSettings(getPrinterSettings());

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddPrinter = () => {
    try {
      const model = PRINTER_MODELS.find((m) => m.id === selectedModelId);
      const nameToUse = newName.trim() || model?.name || '';
      addPrinter(selectedModelId, nameToUse);
      setNewName('');
      setAdding(false);
      refresh();
      showToast('Printer added. Set as default or pair below.', 'ok');
    } catch (e) {
      showToast((e as Error).message, 'er');
    }
  };

  const handleRemove = (id: string) => {
    removePrinter(id);
    refresh();
    showToast('Printer removed', 'ok');
  };

  const handleSetDefault = (id: string) => {
    setDefaultPrinter(id);
    refresh();
    showToast('Default printer updated', 'ok');
  };

  const handleTestPrint = async () => {
    const config = getPrinterConfigForPrint();
    const chars = config?.charsPerLine ?? 46;
    const escPosPaper = paperSizeFromCharsPerLine(chars);
    const escPosPayload = buildTestEscPosReceipt(escPosPaper);
    setTesting(true);
    try {
      const result = await printThermalReceiptDirect(
        'Printer test',
        getThermalTestReceiptBodyHtml(chars),
        getThermalTestReceiptPlainText(chars),
        { printer: config ?? undefined, forceDialog: config?.forceDialog ?? true, escPosPayload }
      );
      if (result === 'blocked') {
        showToast('Allow pop-ups to open print window', 'er');
        return;
      }
      showToast(
        result === 'serial' || result === 'ble' || result === 'native' ? 'Sent to printer' : 'Select ESCPOS in the print dialog',
        'ok',
      );
    } catch (e) {
      showToast((e as Error).message || 'Print failed', 'er');
    } finally {
      setTesting(false);
    }
  };

  const handlePairPrinter = async () => {
    setPairing(true);
    try {
      const config = getPrinterConfigForPrint();
      const chars = config?.charsPerLine ?? 46;
      const escPosPaper = paperSizeFromCharsPerLine(chars);
      const escPosPayload = buildTestEscPosReceipt(escPosPaper);
      const result = await printThermalReceiptDirect(
        'Pair printer',
        getThermalTestReceiptBodyHtml(chars),
        getThermalTestReceiptPlainText(chars),
        { printer: config ?? undefined, forceDialog: config?.forceDialog ?? true, escPosPayload }
      );
      if (result === 'native') showToast('LaundroSwipe Android shell sent data to the printer.', 'ok');
      else if (result === 'serial') showToast('Serial/Bluetooth printer selected. Future prints will use it.', 'ok');
      else if (result === 'ble') showToast('BLE printer selected. Future prints will use it.', 'ok');
      else if (result === 'dialog') showToast('Select ESCPOS Bluetooth Print Service in the print dialog', 'ok');
      else showToast('Allow pop-ups or try again', 'er');
    } catch (e) {
      showToast((e as Error).message || 'Pairing failed', 'er');
    } finally {
      setPairing(false);
    }
  };

  const defaultId = settings.defaultPrinterId;
  const hasPrinters = settings.printers.length > 0;

  return (
    <div className="vendor-page" style={{ fontFamily: 'var(--fb)', background: 'var(--bg)' }}>
      <p style={{ marginBottom: 16, fontSize: 14 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Dashboard</Link>
        {' · '}
        <Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>Vendor Bill</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 6, color: 'var(--b)' }}>Printers</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 28 }}>
        Add a default printer model so receipt width matches your paper. Same settings apply on{' '}
        <Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600 }}>Vendor Bill</Link>.
      </p>

      {/* Known printer models */}
      <section className="vendor-card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, color: 'var(--tx)' }}>Printer models</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {PRINTER_MODELS.map((m) => (
            <li key={m.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--bd)' }}>
              <strong>{m.name}</strong>
              <span style={{ color: 'var(--ts)', fontSize: 13, marginLeft: 8 }}>{m.paperWidthMm}mm · {m.charsPerLine} chars/line</span>
              {m.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ts)' }}>{m.description}</p>}
            </li>
          ))}
        </ul>
      </section>

      {/* Add printer */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, color: 'var(--tx)' }}>Your printers</h2>
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn bp" style={{ marginBottom: 16 }}>
            + Add printer
          </button>
        ) : (
          <div className="vendor-card">
            <label className="fl" style={{ display: 'block', marginBottom: 8 }}>Model</label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value as PrinterModelId)}
              className="fi"
              style={{ width: '100%', maxWidth: 320, marginBottom: 14 }}
            >
              {PRINTER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <label className="fl" style={{ display: 'block', marginBottom: 8 }}>Display name (optional)</label>
            <input
              type="text"
              className="fi"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={PRINTER_MODELS.find((m) => m.id === selectedModelId)?.name}
              style={{ width: '100%', maxWidth: 320, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleAddPrinter} className="btn bp">Add</button>
              <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="btn bout">Cancel</button>
            </div>
          </div>
        )}

        {hasPrinters && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {settings.printers.map((p) => {
              const model = PRINTER_MODELS.find((m) => m.id === p.modelId);
              return (
                <li key={p.id} className="vendor-card" style={{ padding: '14px 20px', marginBottom: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  {model && <span style={{ color: 'var(--ts)', fontSize: 12 }}>{model.paperWidthMm}mm</span>}
                  {p.isDefault && <span style={{ background: 'var(--b)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 6 }}>Default</span>}
                  {!p.isDefault && (
                    <button type="button" onClick={() => handleSetDefault(p.id)} className="btn bout" style={{ fontSize: 12 }}>Set default</button>
                  )}
                  <button type="button" onClick={() => handleRemove(p.id)} className="btn bout" style={{ fontSize: 12, color: 'var(--er)' }}>Remove</button>
                </li>
              );
            })}
          </ul>
        )}
        {!hasPrinters && !adding && (
          <p style={{ color: 'var(--ts)', fontSize: 14 }}>No printers added yet. Add one to set paper width (58mm, 68mm, or 79mm) for receipts.</p>
        )}
      </section>

      {/* Pair & Test */}
      <section className="vendor-card">
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, color: 'var(--tx)' }}>Pair &amp; test</h2>
        <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 14, lineHeight: 1.6 }}>
          Pair: connect this device to your Bluetooth/Serial printer so &quot;Print bill&quot; can send directly. On Android, install <strong>ESCPOS Bluetooth Print Service</strong> from Play Store, then select it in the print dialog every time you print.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.preferPrintDialog !== false}
            onChange={(e) => setPreferPrintDialog(e.target.checked)}
          />
          <span style={{ fontSize: 14 }}>Always use print dialog (select ESCPOS Bluetooth Print Service)</span>
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={handlePairPrinter} disabled={pairing} className="btn bp">
            {pairing ? 'Opening…' : 'Pair printer'}
          </button>
          <button type="button" onClick={handleTestPrint} disabled={testing} className="btn bout">
            {testing ? 'Printing…' : 'Test print'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--tm)', marginTop: 10, marginBottom: 0 }}>
          Test print uses the same ESC/POS layout as Vendor Bill (monospace columns in the print dialog; native / serial / BLE get raw bytes).
        </p>
      </section>

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 20px',
            borderRadius: 12,
            background: toast.type === 'ok' ? 'var(--ok)' : 'var(--er)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            zIndex: 9999,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
