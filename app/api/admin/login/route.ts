import { NextResponse } from 'next/server';
import { createAdminToken, adminSessionCookieHeader } from '@/lib/admin-session';
import { createClient } from '@supabase/supabase-js';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? '';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? '';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  // Optional emergency fallback via env.
  if (SUPER_ADMIN_EMAIL && SUPER_ADMIN_PASSWORD && email === SUPER_ADMIN_EMAIL.toLowerCase() && password === SUPER_ADMIN_PASSWORD) {
    const fallback = createAdminToken(email, 'super_admin');
    const fallbackRes = NextResponse.json({ ok: true, role: 'super_admin', token: fallback || undefined });
    if (fallback) fallbackRes.headers.set('Set-Cookie', adminSessionCookieHeader(fallback));
    return fallbackRes;
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Admin DB auth not configured' }, { status: 503 });
  }

  const { data, error } = await supabase.rpc('admin_login', {
    p_email: email,
    p_password: password,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: 'Login failed' }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.ok) {
    return NextResponse.json({ ok: false, error: 'Invalid email or password' }, { status: 401 });
  }
  const role = row.role === 'super_admin' ? 'super_admin' : 'vendor';
  const vendorId = typeof row.vendor_slug === 'string' ? row.vendor_slug : null;
  const token = createAdminToken(email, role, vendorId);
  const res = NextResponse.json({ ok: true, role, vendorId, token: token || undefined });
  if (token) {
    res.headers.set('Set-Cookie', adminSessionCookieHeader(token));
  }
  return res;
}
