/**
 * In-memory rate limit for admin API routes. Limits requests per IP per window.
 * In serverless this is per-instance; for stricter limits use Redis/Upstash.
 */
const store = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // per IP per minute for admin mutations
const CLEANUP_INTERVAL = 5 * 60 * 1000; // clear old entries every 5 min

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') ?? 'unknown';
  return ip;
}

export function checkAdminRateLimit(request: Request): { ok: true } | { ok: false; retryAfter: number } {
  const key = `admin:${getClientId(request)}`;
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  } else {
    entry.count += 1;
  }
  if (entry.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const n = Date.now();
      Array.from(store.entries()).forEach(([k, v]) => {
        if (n >= v.resetAt) store.delete(k);
      });
    }, CLEANUP_INTERVAL);
  }
  return { ok: true };
}

const MAX_BODY_BYTES = 512 * 1024; // admin schedule payloads can be large (many dates)

export function checkBodySize(request: Request): boolean {
  const len = request.headers.get('content-length');
  if (!len) return true; // no body or chunked
  const n = parseInt(len, 10);
  // Malformed Content-Length must not block saves (some proxies send bad values).
  if (Number.isNaN(n) || n < 0) return true;
  return n <= MAX_BODY_BYTES;
}
