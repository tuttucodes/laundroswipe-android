/**
 * Optional Android WebView bridge: sends raw ESC/POS over Classic Bluetooth (SPP)
 * from native code. The browser cannot open RFCOMM sockets; a thin wrapper APK
 * (see /android-print-bridge) injects this object on window.
 *
 * Inspired by the same job as "ESCPOS Bluetooth Print Service" — without a separate
 * random Play Store app, if you ship your own WebView shell.
 */

export type LaundroSwipeAndroidPrintBridge = {
  /**
   * Decode base64 and send bytes to the paired Bluetooth SPP printer.
   * Return true if the payload was accepted (queued or fully written). False on immediate failure.
   * Run heavy I/O off the main thread inside your implementation to avoid ANR.
   */
  printEscPosBase64?: (base64: string) => boolean;
};

declare global {
  interface Window {
    LaundroSwipeAndroidPrint?: LaundroSwipeAndroidPrintBridge;
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export function isNativeEscPosBridgeAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.LaundroSwipeAndroidPrint?.printEscPosBase64 === 'function';
}

export type NativePrintResult = 'ok' | 'unavailable' | 'error';

/**
 * Deliver pre-built ESC/POS bytes to the native Android printer bridge, if present.
 */
export async function tryNativeEscPosPrint(bytes: Uint8Array): Promise<NativePrintResult> {
  if (typeof window === 'undefined') return 'unavailable';
  const b = window.LaundroSwipeAndroidPrint;
  if (!b) return 'unavailable';
  const payload = uint8ToBase64(bytes);
  try {
    if (typeof b.printEscPosBase64 === 'function') {
      const ok = b.printEscPosBase64(payload);
      return ok !== false ? 'ok' : 'error';
    }
  } catch {
    return 'error';
  }
  return 'unavailable';
}
