'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BluetoothPrinterService,
  buildTestEscPosReceipt,
  isWebBluetoothAvailable,
  printEscPosViaBluetooth,
  type BleConnectionState,
} from '@/lib/printing';
import {
  getBlePrinterPreferences,
  setBlePrinterPreferences,
  syncEscPosPaperFromAdminPrinter,
  type BlePrinterPreferences,
  type BlePrintDensity,
} from '@/lib/ble-printer-settings';
import type { PaperSize } from '@/lib/printing/escpos/ESCPOSBuilder';

function statusLabel(s: BleConnectionState): string {
  if (s === 'connected') return 'Connected';
  if (s === 'connecting') return 'Connecting…';
  return 'Disconnected';
}

export function BluetoothPrinterPanel({
  onPrefsChange,
}: {
  onPrefsChange?: () => void;
}) {
  const [ble, setBle] = useState<BleConnectionState>('disconnected');
  const [prefs, setPrefs] = useState<BlePrinterPreferences>(() => getBlePrinterPreferences());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [storedBleId, setStoredBleId] = useState<string | null>(null);

  useEffect(() => {
    setStoredBleId(BluetoothPrinterService.getInstance().getLastDeviceId());
  }, [ble, busy]);

  const refreshPrefs = () => {
    setPrefs(getBlePrinterPreferences());
    onPrefsChange?.();
  };

  const patchPrefs = (p: Partial<BlePrinterPreferences>) => {
    setBlePrinterPreferences(p);
    refreshPrefs();
  };

  useEffect(() => {
    const svc = BluetoothPrinterService.getInstance();
    svc.setAutoReconnect(prefs.autoConnect);
    return svc.subscribe(setBle);
  }, [prefs.autoConnect]);

  useEffect(() => {
    if (!prefs.autoConnect || !isWebBluetoothAvailable()) return;
    const svc = BluetoothPrinterService.getInstance();
    void svc.reconnectFromStorage().catch(() => {});
  }, [prefs.autoConnect]);

  const handleScan = async () => {
    setErr(null);
    setBusy('Scanning…');
    try {
      await BluetoothPrinterService.getInstance().pickAndConnect();
    } catch (e) {
      const name = (e as Error).name;
      if (name === 'NotFoundError') setErr('No device selected.');
      else setErr((e as Error).message || 'Bluetooth error');
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = () => {
    BluetoothPrinterService.getInstance().disconnectUser();
    BluetoothPrinterService.getInstance().clearStoredDevice();
    setErr(null);
  };

  const handleTestPrint = async () => {
    setErr(null);
    setBusy('Printing…');
    try {
      const bytes = buildTestEscPosReceipt(prefs.paperSize);
      const r = await printEscPosViaBluetooth(bytes);
      if (r === 'printed') setErr(null);
      else if (r === 'not-connected') setErr('Connect a printer first (Scan for printers).');
      else if (r === 'unavailable') setErr('Web Bluetooth not available in this browser.');
      else if (r === 'disabled') setErr('Enable “Print via Bluetooth first” below.');
      else setErr('Print failed — try again or check paper.');
    } catch (e) {
      setErr((e as Error).message || 'Print failed');
    } finally {
      setBusy(null);
    }
  };

  const webOk = isWebBluetoothAvailable();

  return (
    <section className="vendor-card" style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10, color: 'var(--tx)' }}>
        Bluetooth thermal (Web Bluetooth · ESC/POS)
      </h2>
      <p style={{ color: 'var(--ts)', fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
        Sends raw ESC/POS over <strong>BLE</strong> when a printer is connected. <strong>Classic Bluetooth (SPP)</strong>{' '}
        cannot run inside a normal browser tab — that is what Play Store “print service” apps add. To avoid a third-party
        app, ship the small <strong>LaundroSwipe Android shell</strong> in the repo under{' '}
        <code style={{ fontSize: 12 }}>android-print-bridge/</code> (WebView + SPP); the site calls{' '}
        <code style={{ fontSize: 12 }}>window.LaundroSwipeAndroidPrint.printEscPosBase64</code> automatically before BLE
        and before the print dialog. The <code style={{ fontSize: 12 }}>android-print-bridge/</code> app uses{' '}
        <a href="https://github.com/DantSu/ESCPOS-ThermalPrinter-Android" target="_blank" rel="noreferrer" style={{ color: 'var(--b)', fontWeight: 600 }}>
          DantSu/ESCPOS-ThermalPrinter-Android
        </a>{' '}
        (MIT, JitPack) for Bluetooth SPP. In Chrome without the shell, use a BLE printer or the print
        dialog. <Link href="/admin/printers" style={{ color: 'var(--b)', fontWeight: 600 }}>Admin → Printers</Link> sets
        paper width for the HTML path.
      </p>

      {!webOk && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: '#FEF3C7',
            color: '#92400E',
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          Web Bluetooth is not available here. Use Chrome on Android or desktop, or fall back to the system print dialog
          below.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: ble === 'connected' ? 'var(--ok)' : ble === 'connecting' ? '#f59e0b' : 'var(--er)',
          }}
          aria-hidden
        />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{statusLabel(ble)}</span>
        {storedBleId && <span style={{ fontSize: 12, color: 'var(--ts)' }}>Saved device in this browser</span>}
      </div>

      {err && (
        <p style={{ color: 'var(--er)', fontSize: 13, marginBottom: 12 }} role="alert">
          {err}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" className="vendor-btn-primary" disabled={!webOk || !!busy} onClick={handleScan}>
          {busy === 'Scanning…' ? 'Scanning…' : 'Scan for printers'}
        </button>
        <button type="button" className="vendor-btn-secondary" disabled={ble === 'disconnected' && !busy} onClick={handleDisconnect}>
          Forget / disconnect
        </button>
        <button type="button" className="vendor-btn-secondary" disabled={!!busy} onClick={handleTestPrint}>
          {busy === 'Printing…' ? 'Printing…' : 'Test print'}
        </button>
        <button
          type="button"
          className="vendor-btn-secondary"
          onClick={() => {
            const ps = syncEscPosPaperFromAdminPrinter();
            if (ps) refreshPrefs();
            else setErr('Set a default printer in Admin → Printers first.');
          }}
        >
          Sync paper from Admin printer
        </button>
      </div>

      <div style={{ display: 'grid', gap: 14, maxWidth: 420 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={prefs.preferBluetoothEscPos}
            onChange={(e) => patchPrefs({ preferBluetoothEscPos: e.target.checked })}
          />
          <span>Try Bluetooth ESC/POS before opening the print dialog</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={prefs.autoConnect}
            onChange={(e) => patchPrefs({ autoConnect: e.target.checked })}
          />
          <span>Auto-reconnect last printer on this page</span>
        </label>

        <div>
          <label className="fl" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
            Paper width (ESC/POS)
          </label>
          <select
            className="vendor-input"
            value={prefs.paperSize}
            onChange={(e) => patchPrefs({ paperSize: e.target.value as PaperSize })}
            style={{ maxWidth: 280 }}
          >
            <option value="58mm">58mm (32 chars)</option>
            <option value="76mm">76mm (42 chars)</option>
            <option value="78mm">78mm (46 chars)</option>
            <option value="80mm">80mm (48 chars)</option>
          </select>
        </div>

        <div>
          <label className="fl" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
            Print density
          </label>
          <select
            className="vendor-input"
            value={prefs.printDensity}
            onChange={(e) => patchPrefs({ printDensity: e.target.value as BlePrintDensity })}
            style={{ maxWidth: 280 }}
          >
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div>
          <label className="fl" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
            Print job timeout (ms)
          </label>
          <input
            type="number"
            className="vendor-input"
            min={5000}
            max={120000}
            step={1000}
            value={prefs.printTimeoutMs}
            onChange={(e) => patchPrefs({ printTimeoutMs: Number(e.target.value) || 15000 })}
            style={{ maxWidth: 280 }}
          />
        </div>

        <div>
          <label className="fl" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
            Payment QR payload (optional UPI string)
          </label>
          <input
            type="text"
            className="vendor-input"
            placeholder="upi://pay?pa=…"
            value={prefs.paymentQrPayload}
            onChange={(e) => patchPrefs({ paymentQrPayload: e.target.value })}
            style={{ width: '100%', maxWidth: 400 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={prefs.showPaymentQr}
              onChange={(e) => patchPrefs({ showPaymentQr: e.target.checked })}
            />
            <span>Include QR on Bluetooth receipt (if printer supports GS ( k ))</span>
          </label>
        </div>
      </div>
    </section>
  );
}
