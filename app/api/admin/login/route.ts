import { NextResponse } from 'next/server';
import { createAdminToken, adminSessionCookieHeader } from '@/lib/admin-session';

// Credentials exist only in server env (Vercel / .env.local). Never in client bundle.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

export async function POST(request: Request) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Admin not configured' }, { status: 503 });
  }
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    const token = createAdminToken(email);
    const res = NextResponse.json({ ok: true, token: token || undefined });
    if (token) {
      res.headers.set('Set-Cookie', adminSessionCookieHeader(token));
    }
    return res;
  }
  return NextResponse.json({ ok: false, error: 'Invalid email or password' }, { status: 401 });
}
