import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkBodySize } from '@/lib/rate-limit';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  if (!checkBodySize(request)) {
    return NextResponse.json({ ok: false, error: 'Request too large' }, { status: 413 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 503 });
  }

  let body: { name?: string; email?: string; city?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 320) : '';
  const city = typeof body.city === 'string' ? body.city.trim().slice(0, 200) : '';

  if (!email || !city) {
    return NextResponse.json(
      { ok: false, error: 'Email and city are required' },
      { status: 400 },
    );
  }

  try {
    const { error } = await supabase.from('waitlist').insert({
      name: name || null,
      email,
      city,
    });

    if (error) {
      console.error('waitlist insert error', error);
      return NextResponse.json(
        { ok: false, error: error.message || 'Failed to save request' },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('waitlist insert exception', e);
    return NextResponse.json({ ok: false, error: 'Failed to save request' }, { status: 500 });
  }
}

