import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminRequest } from '@/lib/admin-session';
import { checkAdminRateLimit, checkBodySize } from '@/lib/rate-limit';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

const SLUG = 'profab';

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { data, error } = await supabase.from('vendor_profiles').select('*').eq('slug', SLUG).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rate = checkAdminRateLimit(request);
  if (!rate.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (!checkBodySize(request)) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  let body: { name?: string; brief?: string; pricing_details?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const name = body.name != null ? String(body.name).trim().slice(0, 200) : undefined;
  const brief = body.brief != null ? String(body.brief).trim().slice(0, 2000) : undefined;
  const pricing_details = body.pricing_details != null ? String(body.pricing_details).trim().slice(0, 5000) : undefined;
  const updates: { name?: string; brief?: string; pricing_details?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) updates.name = name;
  if (brief !== undefined) updates.brief = brief;
  if (pricing_details !== undefined) updates.pricing_details = pricing_details;
  const { data, error } = await supabase.from('vendor_profiles').update(updates).eq('slug', SLUG).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
