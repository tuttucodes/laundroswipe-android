import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { checkAdminRateLimit, checkBodySize } from '@/lib/rate-limit';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

type Body = {
  email?: string;
  password?: string;
  vendor_slug?: string;
  join_code?: string;
};

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rate = checkAdminRateLimit(request);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
    );
  }

  if (!checkBodySize(request)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const email = body.email != null ? String(body.email).trim().toLowerCase() : '';
  const password = body.password != null ? String(body.password) : '';
  const vendor_slug = body.vendor_slug != null ? String(body.vendor_slug).trim() : '';
  const join_code = body.join_code != null ? String(body.join_code).trim() : '';

  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 chars' }, { status: 400 });
  if (!vendor_slug) return NextResponse.json({ error: 'Vendor slug is required' }, { status: 400 });
  if (!join_code) return NextResponse.json({ error: 'Join code is required' }, { status: 400 });

  try {
    const { data, error } = await supabase.rpc('register_vendor_admin', {
      p_email: email,
      p_password: password,
      p_vendor_slug: vendor_slug,
      p_join_code: join_code,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) {
      return NextResponse.json({ ok: false, error: row?.message ?? 'Could not register vendor account' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: row?.message ?? 'Vendor account created' });
  } catch (e) {
    console.error('POST /api/admin/register-vendor', e);
    return NextResponse.json({ error: 'Failed to register vendor' }, { status: 500 });
  }
}

