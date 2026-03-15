'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for push notifications.
 * The worker at /sw.js handles push and notificationclick; registration enables push when the app is installed.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => { /* registered */ })
      .catch(() => { /* ignore registration errors */ });
  }, []);
  return null;
}
