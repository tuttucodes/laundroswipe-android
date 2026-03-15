'use client';

import { useState, useEffect } from 'react';

const DISMISS_KEY = 'ls_pwa_dismissed';
const ADDED_KEY = 'ls_pwa_added'; // user tapped "I've added it" – don't show again
const DISMISS_DAYS = 7;
const SHOW_DELAY_MS = 1500; // show after 1.5s so we're definitely on client and visible

export default function AddToHomeScreenPrompt() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const timer = window.setTimeout(() => {
      // Already installed: running as standalone (from home screen)
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window as Window & { navigator: { standalone?: boolean } }).navigator?.standalone === true;
      if (standalone) return;

      // User previously said "I've added it"
      if (localStorage.getItem(ADDED_KEY) === '1') return;

      // Mobile: iPhone, iPad, iPod, Android, or generic "Mobile" (many Android)
      const ua = window.navigator.userAgent;
      const mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
      if (!mobile) return;

      // Recently dismissed "Not now"
      const dismissed = localStorage.getItem(DISMISS_KEY);
      const t = dismissed ? parseInt(dismissed, 10) : 0;
      if (t && Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;

      setShow(true);
      setIsIos(/iPhone|iPad|iPod/i.test(ua));
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, [mounted]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const markAdded = () => {
    localStorage.setItem(ADDED_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Add to Home Screen"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #1746A2, #2558C4)',
        color: '#fff',
        padding: 16,
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 20px rgba(0,0,0,.2)',
        zIndex: 99999,
        fontSize: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 28 }}>🧺</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>Add LaundroSwipe to your home screen</strong>
          <p style={{ margin: '4px 0 0', opacity: 0.95 }}>
            {isIos
              ? 'In Safari: tap the Share icon (square with arrow) at the bottom, then scroll and tap "Add to Home Screen".'
              : 'In Chrome: tap the menu (⋮) at the top right, then "Install app" or "Add to Home screen".'}
          </p>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={markAdded}
              aria-label="I've added it"
              style={{
                background: 'rgba(255,255,255,.25)',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              I&apos;ve added it
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              style={{
                background: 'rgba(255,255,255,.2)',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
