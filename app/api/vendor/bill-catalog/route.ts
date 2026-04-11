import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import {
  mergeVendorBillItemsFromDbRow,
  parseBillItemOverrides,
  sanitizeBillItemOverridesForPut,
} from '@/lib/vendor-bill-catalog';

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  let slug: string | null = null;
  if (session.role === 'vendor') {
    slug = String(session.vendorId ?? '').toLowerCase().trim() || null;
  } else if (session.role === 'super_admin') {
    slug = url.searchParams.get('slug')?.toLowerCase().trim() || null;
  }
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('bill_item_overrides')
    .eq('slug', slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const overrides = parseBillItemOverrides(data?.bill_item_overrides);
  const items = mergeVendorBillItemsFromDbRow(slug, data?.bill_item_overrides);
  const res = NextResponse.json({ ok: true, slug, items, overrides });
  res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
  return res;
}

export async function PUT(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'vendor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const slug = String(session.vendorId ?? '').toLowerCase().trim();
  if (!slug) return NextResponse.json({ error: 'Vendor session missing' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const sanitized = sanitizeBillItemOverridesForPut(slug, body);

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { data: profileRow } = await supabase.from('vendor_profiles').select('slug').eq('slug', slug).maybeSingle();
  if (!profileRow) {
    return NextResponse.json(
      { error: 'Vendor profile is not set up for this account. Ask an admin to add your vendor in vendor_profiles.' },
      { status: 400 },
    );
  }

  const { error } = await supabase.from('vendor_profiles').update({ bill_item_overrides: sanitized }).eq('slug', slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = mergeVendorBillItemsFromDbRow(slug, sanitized);
  return NextResponse.json({ ok: true, items, overrides: sanitized }, { headers: jsonHeaders() });
}
