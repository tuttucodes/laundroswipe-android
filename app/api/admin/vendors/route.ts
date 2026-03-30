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
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  if (session.role === 'super_admin') {
    const { data, error } = await supabase.from('vendors').select('id, slug, name, active').order('name', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vendors: data ?? [] });
  }

  const slug = session.vendorId?.toLowerCase().trim();
  if (!slug) return NextResponse.json({ vendors: [] });
  const { data, error } = await supabase.from('vendors').select('id, slug, name, active').eq('slug', slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data ? [data] : [] });
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rate = checkAdminRateLimit(request);
  if (!rate.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (!checkBodySize(request)) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: { slug?: string; name?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const slug = String(body.slug ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  if (!slug || !/^[a-z0-9-]{2,40}$/.test(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Vendor name required' }, { status: 400 });

  const { data, error } = await supabase
    .from('vendors')
    .upsert({ slug, name, active: body.active ?? true }, { onConflict: 'slug' })
    .select('id, slug, name, active')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, vendor: data });
}

