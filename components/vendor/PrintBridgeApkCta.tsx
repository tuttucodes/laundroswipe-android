'use client';

import { useEffect, useState } from 'react';
import { getPrintBridgeApkUrl, isPrintBridgeApkDirectPublicUrl } from '@/lib/print-bridge-apk';

type Props = {
  /** Larger “step 1” layout for Admin → Printers */
  variant?: 'default' | 'printersHero';
};

export function PrintBridgeApkCta({ variant = 'default' }: Props) {
  const href = getPrintBridgeApkUrl();
  const directUrl = isPrintBridgeApkDirectPublicUrl();
  const [apiReady, setApiReady] = useState<boolean | null>(directUrl ? true : null);

  useEffect(() => {
    if (directUrl) return;
    let cancelled = false;
    fetch('/api/print-bridge-apk', { method: 'HEAD' })
      .then((r) => {
        if (!cancelled) setApiReady(r.ok);
      })
      .catch(() => {
        if (!cancelled) setApiReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [directUrl]);

  const isHero = variant === 'printersHero';
  const downloadOk = directUrl || apiReady === true;
  const downloadPending = !directUrl && apiReady === null;
  const downloadMissing = !directUrl && apiReady === false;

  return (
    <section
      id="android-print-apk"
      className="vendor-card"
      style={{
        marginBottom: isHero ? 24 : 20,
        border: isHero ? '2px solid var(--b)' : '1px solid var(--bd)',
        background: isHero
          ? 'linear-gradient(180deg, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.02) 100%)'
          : 'linear-gradient(180deg, rgba(37,99,235,0.06) 0%, transparent 100%)',
        padding: isHero ? '20px 20px 18px' : undefined,
      }}
    >
      {isHero && (
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--b)', letterSpacing: 0.02 }}>
          ANDROID TABLET / PHONE
        </p>
      )}
      <h2
        style={{
          fontSize: isHero ? 20 : 17,
          fontWeight: 700,
          marginBottom: 10,
          color: 'var(--tx)',
        }}
      >
        {isHero ? 'Download the LaundroSwipe Print app (APK)' : 'Android: LaundroSwipe Print app'}
      </h2>
      <p style={{ color: 'var(--ts)', fontSize: isHero ? 15 : 14, lineHeight: 1.55, marginBottom: 16 }}>
        Use this on Android when your thermal printer uses <strong>Classic Bluetooth</strong> (not BLE-only). Install the
        APK, pair the printer in Android settings, then set the printer MAC in the app config (see repo{' '}
        <code style={{ fontSize: 12 }}>android-print-bridge/</code>). Open the app, log into admin, and print — the site
        sends ESC/POS through <code style={{ fontSize: 12 }}>window.LaundroSwipeAndroidPrint</code>; no Play Store print
        plugin needed.
      </p>

      {downloadPending && (
        <p style={{ fontSize: 14, color: 'var(--ts)', marginBottom: 12 }}>Checking download…</p>
      )}

      {downloadMissing && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: '#FEF3C7',
            color: '#92400E',
            fontSize: 14,
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          <strong>APK not on this server yet.</strong> Your deployer should either set{' '}
          <code style={{ fontSize: 12 }}>NEXT_PUBLIC_PRINT_BRIDGE_APK_URL</code> or{' '}
          <code style={{ fontSize: 12 }}>PRINT_BRIDGE_APK_URL</code> (server-only) to a hosted file, or add{' '}
          <code style={{ fontSize: 12 }}>public/downloads/laundroswipe-print-bridge.apk</code> and redeploy. See{' '}
          <code style={{ fontSize: 12 }}>public/downloads/HOWTO-APK.txt</code>.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {downloadOk && (
          <a
            href={href}
            download={directUrl ? undefined : 'laundroswipe-print-bridge.apk'}
            className="vendor-btn-primary"
            style={{ textDecoration: 'none', minWidth: isHero ? 220 : undefined }}
          >
            {isHero ? '⬇ Download APK for Android' : 'Download APK'}
          </a>
        )}
        {!downloadOk && !downloadPending && (
          <span className="vendor-btn-secondary" style={{ opacity: 0.7, cursor: 'not-allowed', pointerEvents: 'none' }}>
            Download unavailable
          </span>
        )}
        {downloadOk && (
          <span style={{ fontSize: 13, color: 'var(--ts)', maxWidth: 440 }}>
            After install: allow Bluetooth → pair printer → set MAC in app strings → open Vendor / Printers in the app.
          </span>
        )}
      </div>
    </section>
  );
}
