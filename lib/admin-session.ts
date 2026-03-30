import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'admin_session';
const MAX_AGE_SEC = 24 * 60 * 60; // 24h
export type AdminRole = 'super_admin' | 'vendor';
export type AdminSessionData = { email: string; exp: number; role: AdminRole; vendorId?: string | null };

/**
 * Used to HMAC-sign admin session tokens. Must be stable across deploys.
 * Prefer ADMIN_SESSION_SECRET; falls back to legacy ADMIN_PASSWORD or SUPER_ADMIN_PASSWORD
 * so env-only super-admin login still gets a valid session.
 */
function getSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_PASSWORD ??
    process.env.SUPER_ADMIN_PASSWORD ??
    ''
  );
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
export function createAdminToken(email: string, role: AdminRole = 'super_admin', vendorId?: string | null): string {
  const secret = getSecret();
  if (!secret) return '';
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = b64urlEncode(JSON.stringify({ email: email.trim().toLowerCase(), exp, role, vendorId: vendorId ?? null }));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify cookie value and return email if valid.
 */
export function verifyAdminToken(cookieValue: string | null | undefined): string | null {
  const s = verifyAdminSession(cookieValue);
  return s?.email ?? null;
}

export function verifyAdminSession(cookieValue: string | null | undefined): AdminSessionData | null {
  if (!cookieValue?.includes('.')) return null;
  const secret = getSecret();
  if (!secret) return null;
  const [payload, sig] = cookieValue.split('.');
  if (!payload || !sig) return null;
  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig.length !== expectedSig.length || !timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) return null;
  let data: { email?: string; exp?: number; role?: AdminRole; vendorId?: string | null };
  try {
    data = JSON.parse(b64urlDecode(payload));
  } catch {
    return null;
  }
  if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
  if (!data.email) return null;
  const role: AdminRole = data.role === 'vendor' ? 'vendor' : 'super_admin';
  return { email: data.email, exp: data.exp, role, vendorId: data.vendorId ?? null };
}

export function getAdminSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/** Get admin token from cookie or Authorization: Bearer (so auth works when cookies are blocked). */
export function getAdminTokenFromRequest(request: Request): string | null {
  const fromCookie = getAdminSessionCookie(request);
  if (fromCookie) return fromCookie;
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

/** Returns true if the request has a valid admin session (cookie or Bearer). */
export function isAdminRequest(request: Request): boolean {
  const token = getAdminTokenFromRequest(request);
  return verifyAdminToken(token) !== null;
}

export function getAdminSessionFromRequest(request: Request): AdminSessionData | null {
  const token = getAdminTokenFromRequest(request);
  return verifyAdminSession(token);
}

export function adminSessionCookieHeader(token: string): string {
  const isSecure = process.env.NODE_ENV === 'production';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${isSecure ? '; Secure' : ''}`;
}
