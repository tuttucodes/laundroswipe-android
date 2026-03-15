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
import { printThermalReceiptDirect } from '@/lib/thermal-print';
import { getPrinterConfigForPrint } from '@/lib/printer-settings';

function getTestReceiptHtml(): string {
  const date = new Date().toLocaleString();
  return `
<h2>LaundroSwipe</h2>
<p class="meta">Printer test</p>
<p><strong>Date:</strong> ${date}</p>
<p>If you see this on paper, your printer is set up correctly.</p>
<p class="foot">Thank you!</p>
`;
}

function getTestReceiptPlain(): string {
  return [
    'LaundroSwipe',
    'Printer test',
    `Date: ${new Date().toLocaleString()}`,
    'If you see this on paper, your printer is set up correctly.',
    'Thank you!',
  ].join('\n');
}

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
    setTesting(true);
    try {
      const result = await printThermalReceiptDirect(
        'Printer test',
        getTestReceiptHtml(),
        getTestReceiptPlain(),
        { printer: config ?? undefined, forceDialog: config?.forceDialog ?? true }
      );
      if (result === 'blocked') {
        showToast('Allow pop-ups to open print window', 'er');
        return;
      }
      showToast(result === 'serial' || result === 'ble' ? 'Sent to printer' : 'Select ESCPOS in the print dialog', 'ok');
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
      const result = await printThermalReceiptDirect(
        'Pair printer',
        getTestReceiptHtml(),
        getTestReceiptPlain(),
        { printer: config ?? undefined, forceDialog: config?.forceDialog ?? true }
      );
      if (result === 'serial') showToast('Serial/Bluetooth printer selected. Future prints will use it.', 'ok');
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
    <div style={{ fontFamily: 'var(--fb)', background: 'var(--bg)', minHeight: '100vh', padding: 24 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/admin" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>← Dashboard</Link>
        {' · '}
        <Link href="/admin/vendor" style={{ color: 'var(--b)', fontWeight: 600, textDecoration: 'none' }}>Vendor Bill</Link>
      </p>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 24, marginBottom: 8, color: 'var(--b)' }}>Printers</h1>
      <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 24 }}>
        Add your receipt printer (e.g. 68mm or Epson M80 79mm). Set a default so bills print with the correct paper width. Use &quot;Pair printer&quot; to connect via Bluetooth/Serial for one-tap printing where supported.
      </p>

      {/* Known printer models */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Printer models</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {PRINTER_MODELS.map((m) => (
            <li key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--bor)' }}>
              <strong>{m.name}</strong>
              <span style={{ color: 'var(--ts)', fontSize: 13, marginLeft: 8 }}>{m.paperWidthMm}mm · {m.charsPerLine} chars/line</span>
              {m.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ts)' }}>{m.description}</p>}
            </li>
          ))}
        </ul>
      </section>

      {/* Add printer */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Your printers</h2>
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn bp" style={{ marginBottom: 16 }}>
            + Add printer
          </button>
        ) : (
          <div style={{ background: 'var(--card)', padding: 16, borderRadius: 12, marginBottom: 16, border: '1px solid var(--bor)' }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Model</label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value as PrinterModelId)}
              style={{ width: '100%', maxWidth: 320, padding: '8px 12px', marginBottom: 12, borderRadius: 8, border: '1px solid var(--bor)' }}
            >
              {PRINTER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Display name (optional)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={PRINTER_MODELS.find((m) => m.id === selectedModelId)?.name}
              style={{ width: '100%', maxWidth: 320, padding: '8px 12px', marginBottom: 12, borderRadius: 8, border: '1px solid var(--bor)' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                <li key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--bor)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
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
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Pair &amp; test</h2>
        <p style={{ color: 'var(--ts)', fontSize: 14, marginBottom: 12 }}>
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={handlePairPrinter} disabled={pairing} className="btn bp">
            {pairing ? 'Opening…' : 'Pair printer'}
          </button>
          <button type="button" onClick={handleTestPrint} disabled={testing} className="btn bout">
            {testing ? 'Printing…' : 'Test print'}
          </button>
        </div>
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
