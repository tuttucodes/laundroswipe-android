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

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { data, error } = await supabase
    .from('colleges')
    .select('id, name, short_code, city, state, is_active')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ areas: data ?? [] });
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rate = checkAdminRateLimit(request);
  if (!rate.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (!checkBodySize(request)) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: { name?: string; short_code?: string; city?: string; state?: string; is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const shortCode = String(body.short_code ?? '').trim().toUpperCase();
  if (!name) return NextResponse.json({ error: 'Area name required' }, { status: 400 });
  if (!shortCode || !/^[A-Z0-9_]{2,30}$/.test(shortCode)) return NextResponse.json({ error: 'Invalid short code' }, { status: 400 });

  const { data, error } = await supabase
    .from('colleges')
    .upsert(
      {
        name,
        short_code: shortCode,
        city: String(body.city ?? '').trim() || null,
        state: String(body.state ?? '').trim() || null,
        is_active: body.is_active ?? false,
      },
      { onConflict: 'short_code' },
    )
    .select('id, name, short_code, city, state, is_active')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, area: data });
}

