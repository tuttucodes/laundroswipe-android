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

function resolveSlug(request: Request, bodySlug?: string): string | null {
  const s = getAdminSessionFromRequest(request);
  if (!s) return null;
  if (s.role === 'vendor') return s.vendorId ?? null;
  const q = new URL(request.url).searchParams.get('slug')?.trim();
  return (bodySlug?.trim() || q || 'profab') || 'profab';
}

export async function GET(request: Request) {
  const slug = resolveSlug(request);
  if (!slug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { data, error } = await supabase.from('vendor_profiles').select('id, slug, name, brief, pricing_details, logo_url, updated_at').eq('slug', slug).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rate = checkAdminRateLimit(request);
  if (!rate.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (!checkBodySize(request)) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  let body: { name?: string; brief?: string; pricing_details?: string; logo_url?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const slug = resolveSlug(request, body.slug);
  if (!slug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const name = body.name != null ? String(body.name).trim().slice(0, 200) : undefined;
  const brief = body.brief != null ? String(body.brief).trim().slice(0, 2000) : undefined;
  const pricing_details = body.pricing_details != null ? String(body.pricing_details).trim().slice(0, 5000) : undefined;
  const logo_url = body.logo_url != null ? String(body.logo_url).trim().slice(0, 300000) : undefined;
  const now = new Date().toISOString();
  const { data: existing } = await supabase.from('vendor_profiles').select('name, brief, pricing_details, logo_url').eq('slug', slug).maybeSingle();
  const row = {
    slug,
    name: name !== undefined ? name : (existing?.name ?? 'Vendor'),
    brief: brief !== undefined ? brief : (existing?.brief ?? null),
    pricing_details: pricing_details !== undefined ? pricing_details : (existing?.pricing_details ?? null),
    logo_url: logo_url !== undefined ? logo_url : (existing?.logo_url ?? null),
    updated_at: now,
  };
  const { data, error } = await supabase
    .from('vendor_profiles')
    .upsert(row, { onConflict: 'slug', ignoreDuplicates: false })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
