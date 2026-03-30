/**
 * Optional Cloudflare Turnstile verification.
 *
 * If TURNSTILE_SECRET_KEY is not configured, verification is skipped.
 * If TURNSTILE_SECRET_KEY is configured and TURNSTILE_ENFORCE=true, missing/invalid tokens fail the request.
 */

type VerifyParams = {
  token: string | null | undefined;
};

export async function verifyTurnstileToken({ token }: VerifyParams): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? '';
  const enforce = (process.env.TURNSTILE_ENFORCE ?? '').toLowerCase() === 'true';

  if (!secret) return { ok: true }; // captcha not configured
  if (!enforce) return { ok: true }; // captcha configured but not enforced

  const t = (token ?? '').trim();
  if (!t) return { ok: false, error: 'Missing captcha token' };

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: t }).toString(),
  });

  if (!res.ok) return { ok: false, error: 'Captcha verification failed' };

  const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
  if (!data?.success) return { ok: false, error: 'Captcha verification failed' };

  return { ok: true };
}

