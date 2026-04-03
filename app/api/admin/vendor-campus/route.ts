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
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { data, error } = await supabase
    .from('vendor_campus')
    .select(
      `
      campus_id,
      vendor_id,
      vendors ( slug, name )
    `,
    )
    .order('campus_id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const listings = (data as unknown[] | null)?.map((raw) => {
    const r = raw as {
      campus_id: string;
      vendor_id: string;
      vendors: { slug: string; name: string } | { slug: string; name: string }[] | null;
    };
    const pack = r.vendors == null ? null : Array.isArray(r.vendors) ? r.vendors[0] : r.vendors;
    return {
      campus_id: r.campus_id,
      vendor_id: r.vendor_id,
      vendor_slug: pack?.slug ?? '',
      vendor_name: pack?.name ?? '',
    };
  });

  return NextResponse.json({ listings: listings ?? [] });
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rate = checkAdminRateLimit(request);
  if (!rate.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (!checkBodySize(request)) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: { vendor_slug?: string; campus_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const slug = String(body.vendor_slug ?? '').trim().toLowerCase();
  const campusId = String(body.campus_id ?? '').trim();
  if (!slug || !/^[a-z0-9-]{2,40}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid vendor_slug' }, { status: 400 });
  }
  if (!campusId || campusId.length > 64) {
    return NextResponse.json({ error: 'Invalid campus_id' }, { status: 400 });
  }

  const { data: vendor, error: vErr } = await supabase.from('vendors').select('id, slug').eq('slug', slug).maybeSingle();
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });
  if (!vendor?.id) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  const { error: insErr } = await supabase.from('vendor_campus').insert({ vendor_id: vendor.id, campus_id: campusId });
  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json({ ok: true, message: 'Already linked' });
    }
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rate = checkAdminRateLimit(request);
  if (!rate.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(request.url);
  const slug = url.searchParams.get('vendor_slug')?.trim().toLowerCase();
  const campusId = url.searchParams.get('campus_id')?.trim();
  if (!slug || !campusId) {
    return NextResponse.json({ error: 'vendor_slug and campus_id query params required' }, { status: 400 });
  }

  const { data: vendor, error: vErr } = await supabase.from('vendors').select('id').eq('slug', slug).maybeSingle();
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 400 });
  if (!vendor?.id) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  const { error: delErr } = await supabase.from('vendor_campus').delete().eq('vendor_id', vendor.id).eq('campus_id', campusId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
