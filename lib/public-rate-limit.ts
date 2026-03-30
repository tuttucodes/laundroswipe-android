/**
 * Simple in-memory rate limiter for public POST endpoints.
 * Note: in serverless, this is per-instance. Good baseline protection.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function checkPublicRateLimit(params: {
  request: Request;
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
}): { ok: true } | { ok: false; retryAfter: number } {
  const { request, keyPrefix, windowMs, maxRequests } = params;
  const ip = getClientIp(request);
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
  } else {
    entry.count += 1;
  }

  if (entry.count > maxRequests) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { ok: true };
}

