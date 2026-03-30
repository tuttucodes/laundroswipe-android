'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: any;
  }
}

export function TurnstileWidget(props: { onToken: (token: string) => void; theme?: 'light' | 'dark' }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    if (!containerRef.current) return;

    let cancelled = false;

    const load = async () => {
      // Avoid double-loading.
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="1"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-turnstile', '1');
        document.body.appendChild(script);
      }

      // Wait for window.turnstile to exist.
      const start = Date.now();
      while (!cancelled && !(window.turnstile && window.turnstile.render)) {
        if (Date.now() - start > 8000) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      if (cancelled) return;

      setReady(true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  useEffect(() => {
    if (!ready) return;
    if (!siteKey) return;
    if (!containerRef.current) return;
    if (!window.turnstile?.render) return;

    // Clear previous instances if the component remounts.
    containerRef.current.innerHTML = '';

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: props.theme ?? 'light',
      callback: (token: string) => props.onToken(token),
      'expired-callback': () => props.onToken(''),
    });

    return () => {
      try {
        if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
      } catch {
        // no-op
      }
    };
  }, [ready, siteKey, props, props.theme]);

  if (!siteKey) return null;
  return <div ref={containerRef} />;
}

