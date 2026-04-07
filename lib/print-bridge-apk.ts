/**
 * Android print-bridge APK (Admin → Printers).
 *
 * - If NEXT_PUBLIC_PRINT_BRIDGE_APK_URL is set → open that URL directly (CDN / GitHub Releases).
 * - Else → /api/print-bridge-apk (redirects to server-only URL, or to /downloads/*.apk, or 404).
 */

const API_PATH = '/api/print-bridge-apk';

export function getPrintBridgeApkUrl(): string {
  const pub = typeof process.env.NEXT_PUBLIC_PRINT_BRIDGE_APK_URL === 'string'
    ? process.env.NEXT_PUBLIC_PRINT_BRIDGE_APK_URL.trim()
    : '';
  if (pub) return pub;
  return API_PATH;
}

export function isPrintBridgeApkDirectPublicUrl(): boolean {
  const pub = typeof process.env.NEXT_PUBLIC_PRINT_BRIDGE_APK_URL === 'string'
    ? process.env.NEXT_PUBLIC_PRINT_BRIDGE_APK_URL.trim()
    : '';
  return pub.length > 0;
}
