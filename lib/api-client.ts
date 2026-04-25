import { env } from './env';
import { getAccessToken } from './supabase';
import { readAdminSession } from './admin-auth';

/**
 * Fetch wrapper for the web app's server routes. These endpoints enforce policy that cannot
 * be moved into the client (idempotency, schedule guard, bill fingerprint, vendor scope):
 *
 *   Customer (Supabase JWT):
 *     POST /api/orders/create          — schedule + campus + terms + student-details guard
 *     GET  /api/me/bootstrap           — profile + 10 recent orders + 10 recent bills + unread
 *     GET  /api/me/vendor-bills        — RPC get_my_bills (slim), ETag-cached
 *     POST /api/terms/accept           — bump users.terms_version
 *
 *   Admin / Vendor (HMAC token from /api/admin/login):
 *     POST /api/admin/login            — returns { role, vendorId, token }
 *     POST /api/admin/orders/advance   — status pipeline step
 *     POST /api/vendor/orders/lookup   — token → order + user + latest_bill + can_cancel
 *     POST /api/vendor/orders/confirm-delivery
 *     POST /api/vendor/bills/save      — idempotency-keyed (lineItemsFingerprint)
 *     POST /api/vendor/bills/update
 *     POST /api/vendor/bills/cancel    — 1-hour window
 *     GET  /api/vendor/bills           — paginated, filter by token/date/total
 *     GET  /api/vendor/bill-catalog    — items + vendor-specific overrides
 *     PUT  /api/vendor/bill-catalog    — vendor updates overrides
 *     GET  /api/vendor/revenue         — aggregated revenue (ISR)
 *
 *   Public (no auth):
 *     GET  /api/schedule               — slots + dates (ISR, ETag)
 *     GET  /api/vendors/catalog?campus_id=... — campus filter
 */

export type ApiErrorShape = {
  message: string;
  status: number;
  code?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;
  constructor(shape: ApiErrorShape, body: unknown) {
    super(shape.message);
    this.status = shape.status;
    this.code = shape.code;
    this.body = body;
  }
}

type AuthMode = 'user' | 'admin' | 'none';

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  auth?: AuthMode;
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
  /** Extra headers. Authorization is injected based on `auth`. */
  headers?: Record<string, string>;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: FetchOptions['query']): string {
  const base = env.webOrigin.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!query) return `${base}${cleanPath}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined) continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs.length ? `${base}${cleanPath}?${qs}` : `${base}${cleanPath}`;
}

async function authorizationHeader(mode: AuthMode): Promise<string | null> {
  if (mode === 'none') return null;
  if (mode === 'user') {
    const token = await getAccessToken();
    return token ? `Bearer ${token}` : null;
  }
  const session = await readAdminSession();
  return session ? `Bearer ${session.token}` : null;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const auth = opts.auth ?? 'user';
  const url = buildUrl(path, opts.query);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers ?? {}),
  };
  if (opts.body !== undefined && opts.body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const authz = await authorizationHeader(auth);
  if (authz) headers.Authorization = authz;

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined && opts.body !== null ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  let parsed: unknown = null;
  const text = await res.text();
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const body = parsed as { error?: string; code?: string } | null;
    throw new ApiError(
      {
        message: body?.error ?? res.statusText ?? 'Request failed',
        status: res.status,
        code: body?.code,
      },
      parsed,
    );
  }

  return parsed as T;
}
