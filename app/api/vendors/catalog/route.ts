import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Public catalog: laundry partners available at a campus (`users.college_id`, e.g. vit-chn). */
export async function GET(request: Request) {
  const campusId = new URL(request.url).searchParams.get('campus_id')?.trim();
  if (!campusId) {
    return NextResponse.json({ error: 'Missing campus_id query parameter' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { data: vcRows, error: vcErr } = await supabase.from('vendor_campus').select('vendor_id').eq('campus_id', campusId);

  if (vcErr) {
    if (vcErr.code === '42P01' || vcErr.message?.includes('vendor_campus')) {
      return NextResponse.json({ campus_id: campusId, vendors: [] });
    }
    return NextResponse.json({ error: vcErr.message }, { status: 500 });
  }

  const vendorIds = [...new Set((vcRows ?? []).map((r) => r.vendor_id).filter(Boolean))] as string[];
  if (vendorIds.length === 0) {
    return NextResponse.json({ campus_id: campusId, vendors: [] });
  }

  const { data: vRows, error: vErr } = await supabase
    .from('vendors')
    .select('id, slug, name, active')
    .in('id', vendorIds)
    .eq('active', true);

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  const active = vRows ?? [];
  const slugs = active.map((v) => v.slug).filter(Boolean);
  if (slugs.length === 0) {
    return NextResponse.json({ campus_id: campusId, vendors: [] });
  }

  const { data: profiles, error: pErr } = await supabase
    .from('vendor_profiles')
    .select('slug, name, logo_url, brief')
    .in('slug', slugs);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const bySlug = new Map((profiles ?? []).map((p) => [p.slug, p]));

  const vendors = active.map((v) => {
    const p = bySlug.get(v.slug);
    return {
      slug: v.slug,
      name: v.name,
      profile_name: p?.name ?? null,
      logo_url: p?.logo_url ?? null,
      brief: p?.brief ?? null,
    };
  });

  return NextResponse.json({ campus_id: campusId, vendors });
}
