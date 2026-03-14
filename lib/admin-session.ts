import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'admin_session';
const MAX_AGE_SEC = 24 * 60 * 60; // 24h

function getSecret(): string {
  return process.env.ADMIN_PASSWORD ?? '';
}

/** Encode payload to base64url (no padding). */
function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

/** Decode base64url. */
function b64urlDecode(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

/**
 * Create a signed token for admin session. Use as cookie value.
 */
export function createAdminToken(email: string): string {
  const secret = getSecret();
  if (!secret) return '';
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = b64urlEncode(JSON.stringify({ email: email.trim().toLowerCase(), exp }));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify cookie value and return email if valid.
 */
export function verifyAdminToken(cookieValue: string | null | undefined): string | null {
  if (!cookieValue?.includes('.')) return null;
  const secret = getSecret();
  if (!secret) return null;
  const [payload, sig] = cookieValue.split('.');
  if (!payload || !sig) return null;
  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig.length !== expectedSig.length || !timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) return null;
  let data: { email?: string; exp?: number };
  try {
    data = JSON.parse(b64urlDecode(payload));
  } catch {
    return null;
  }
  if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
  return data.email ?? null;
}

export function getAdminSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export function adminSessionCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}`;
}
