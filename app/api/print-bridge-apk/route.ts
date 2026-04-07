import { existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

const FILENAME = 'laundroswipe-print-bridge.apk';

function externalApkUrl(): string {
  const serverOnly = process.env.PRINT_BRIDGE_APK_URL?.trim() ?? '';
  const publicUrl = process.env.NEXT_PUBLIC_PRINT_BRIDGE_APK_URL?.trim() ?? '';
  return serverOnly || publicUrl;
}

function localApkPath(): string {
  return join(process.cwd(), 'public', 'downloads', FILENAME);
}

/**
 * Single entry for “Download APK” when the app is not using a direct NEXT_PUBLIC URL in the client.
 * - Redirects to PRINT_BRIDGE_APK_URL or NEXT_PUBLIC_PRINT_BRIDGE_APK_URL when set (good for large files on CDN).
 * - Else redirects to /downloads/... so the file is served as static assets (works on Vercel; avoids huge route bodies).
 */
export async function GET(request: Request) {
  const ext = externalApkUrl();
  if (ext) {
    return NextResponse.redirect(ext, 302);
  }

  if (existsSync(localApkPath())) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/downloads/${FILENAME}`, 302);
  }

  return NextResponse.json(
    {
      error: 'APK not available',
      message:
        'Set PRINT_BRIDGE_APK_URL or NEXT_PUBLIC_PRINT_BRIDGE_APK_URL, or add public/downloads/laundroswipe-print-bridge.apk',
    },
    { status: 404 },
  );
}

export async function HEAD() {
  if (externalApkUrl()) {
    return new NextResponse(null, { status: 200 });
  }
  if (existsSync(localApkPath())) {
    return new NextResponse(null, { status: 200 });
  }
  return new NextResponse(null, { status: 404 });
}
