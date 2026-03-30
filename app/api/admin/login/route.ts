import { NextResponse } from 'next/server';
import { createAdminToken, adminSessionCookieHeader } from '@/lib/admin-session';
import { createServiceSupabase } from '@/lib/supabase-service';

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'Email and password are required' }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured (SUPABASE_SERVICE_ROLE_KEY required for admin login)' },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.rpc('admin_login', {
    p_email: email,
    p_password: password,
  });

  if (error) {
    console.error('admin_login rpc', error);
    return NextResponse.json(
      { ok: false, error: 'Login failed. Run migration 20260332_admin_login_email_only.sql if this persists.' },
      { status: 500 }
    );
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.ok) {
    return NextResponse.json({ ok: false, error: 'Invalid email or password' }, { status: 401 });
  }

  const role = row.role === 'super_admin' ? 'super_admin' : 'vendor';
  const vendorId = typeof row.vendor_slug === 'string' ? row.vendor_slug : null;

  let vendorDisplayName: string | null = null;
  if (vendorId) {
    const { data: vr } = await supabase.from('vendors').select('name').eq('slug', vendorId).maybeSingle();
    vendorDisplayName = vr?.name ?? null;
  }

  const token = createAdminToken(email, role, vendorId);
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Server misconfiguration: set ADMIN_SESSION_SECRET (or ADMIN_PASSWORD) so sessions can be signed.',
      },
      { status: 503 }
    );
  }

  const res = NextResponse.json({ ok: true, role, vendorId, vendorDisplayName, token });
  res.headers.set('Set-Cookie', adminSessionCookieHeader(token));
  return res;
}
