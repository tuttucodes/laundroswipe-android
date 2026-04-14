type Bucket = {
  count: number;
  resetAtMs: number;
};

const buckets = new Map<string, Bucket>();

function nowMs(): number {
  return Date.now();
}

export function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return fallback;
}

export function clampBillsLimit(requested: number): number {
  const limit = Number.isFinite(requested) ? requested : 20;
  return Math.min(50, Math.max(1, Math.floor(limit)));
}

/**
 * Lightweight in-memory fixed-window limiter for serverless warm instances.
 * Best-effort guardrail to prevent endpoint abuse/spikes.
 */
export function allowInWindow(key: string, limit: number, windowMs: number): boolean {
  const now = nowMs();
  const row = buckets.get(key);
  if (!row || row.resetAtMs <= now) {
    buckets.set(key, { count: 1, resetAtMs: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  buckets.set(key, row);
  return true;
}

export function isConservationMode(): boolean {
  return envBool('BILLING_CONSERVATION_MODE', false);
}

