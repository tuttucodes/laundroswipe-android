import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { getVendorsListCached } from '@/lib/supabase-metadata-cache';
import { istYmdEndIso, istYmdStartIso } from '@/lib/ist-dates';

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseOptionalNumber(v: string | null): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type DbVendor = { id: string; slug: string; name: string };

function resolveVendorSlugFromName(vendorName: string | null | undefined, dbVendors: DbVendor[]): string | null {
  const v = (vendorName ?? '').toLowerCase().trim();
  if (!v) return null;
  const dbMatch = dbVendors.find((x) => v.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(v));
  if (dbMatch) return dbMatch.slug;
  const match = VENDORS.find((x) => v.includes(x.name.toLowerCase()) || v === x.name.toLowerCase());
  return match?.id ?? null;
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  const tokenSearchRaw = (url.searchParams.get('token') ?? '').replace(/^#/, '').trim();
  const dateFromParam = (url.searchParams.get('date_from') ?? '').trim();
  const dateToParam = (url.searchParams.get('date_to') ?? '').trim();
  const dateFromYmd = YMD_RE.test(dateFromParam) ? dateFromParam : null;
  const dateToYmd = YMD_RE.test(dateToParam) ? dateToParam : null;
  const totalMin = parseOptionalNumber(url.searchParams.get('total_min'));
  const totalMax = parseOptionalNumber(url.searchParams.get('total_max'));
  const subtotalMin = parseOptionalNumber(url.searchParams.get('subtotal_min'));
  const subtotalMax = parseOptionalNumber(url.searchParams.get('subtotal_max'));

  const vendorSlug = session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? '' : '';
  const { data: vendorsData, error: vendorsError } = await getVendorsListCached(supabase);
  if (vendorsError) return NextResponse.json({ error: vendorsError.message }, { status: 500 });
  const dbVendors = vendorsData as DbVendor[];
  const vendorsById = new Map<string, string>(dbVendors.map((v) => [String(v.id), v.slug]));

  // For vendor-scoped queries, filter server-side by vendor_id when possible
  const vendorDbId = vendorSlug
    ? dbVendors.find((v) => v.slug === vendorSlug)?.id ?? null
    : null;

  let data: any[] | null = null;
  let error: { message: string; code?: string } | null = null;
  let totalCount = 0;

  const buildQuery = (cols: string) => {
    let q = supabase
      .from('vendor_bills')
      .select(cols, { count: 'exact' })
      .order('created_at', { ascending: false });
    if (session.role === 'vendor') {
      q = q.is('cancelled_at', null);
    }
    if (vendorDbId) q = q.eq('vendor_id', vendorDbId);
    if (tokenSearchRaw) {
      q = q.ilike('order_token', `%${escapeIlikePattern(tokenSearchRaw)}%`);
    }
    if (dateFromYmd) q = q.gte('created_at', istYmdStartIso(dateFromYmd));
    if (dateToYmd) q = q.lte('created_at', istYmdEndIso(dateToYmd));
    if (totalMin !== null) q = q.gte('total', totalMin);
    if (totalMax !== null) q = q.lte('total', totalMax);
    if (subtotalMin !== null) q = q.gte('subtotal', subtotalMin);
    if (subtotalMax !== null) q = q.lte('subtotal', subtotalMax);
    q = q.range(offset, offset + limit - 1);
    return q;
  };

  const withCancelCols = await buildQuery(
    'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, created_at, cancelled_at, cancelled_by_role',
  );
  data = withCancelCols.data as any[] | null;
  error = withCancelCols.error as { message: string; code?: string } | null;
  totalCount = (withCancelCols as any).count ?? 0;
  if (error?.code === '42703') {
    const fallback = await buildQuery(
      'id, order_id, order_token, order_number, customer_name, customer_phone, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, created_at',
    );
    data = ((fallback.data as any[] | null) ?? []).map((row) => ({
      ...row,
      customer_reg_no: null,
      customer_hostel_block: null,
      customer_room_number: null,
      cancelled_at: null,
      cancelled_by_role: null,
    }));
    error = fallback.error as { message: string; code?: string } | null;
    totalCount = (fallback as any).count ?? 0;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Client-side vendor filter fallback (for bills without vendor_id but matching vendor_name)
  const vendorFiltered = vendorSlug
    ? (data ?? []).filter((b: any) => {
        if (vendorDbId && b.vendor_id === vendorDbId) return true;
        const byVendorId = b.vendor_id ? vendorsById.get(String(b.vendor_id)) : null;
        const byVendorName = resolveVendorSlugFromName(b.vendor_name, dbVendors);
        const billVendorSlug = (byVendorId ?? byVendorName ?? null) as string | null;
        return String(billVendorSlug ?? '').toLowerCase() === vendorSlug;
      })
    : (data ?? []);

  const raw: any[] = [...vendorFiltered];

  const userIds = Array.from(new Set(raw.map((b: any) => b.user_id).filter(Boolean))) as string[];
  let userMap = new Map<string, { full_name: string | null; email: string | null; phone: string | null; display_id: string | null }>();
  if (userIds.length > 0) {
    const { data: urows } = await supabase
      .from('users')
      .select('id, full_name, email, phone, display_id')
      .in('id', userIds);
    for (const u of urows ?? []) {
      userMap.set(String((u as { id: string }).id), u as { full_name: string | null; email: string | null; phone: string | null; display_id: string | null });
    }
  }

  const rows = raw.map((b: any) => {
    const u = b.user_id ? userMap.get(String(b.user_id)) : undefined;
    const nameFromUser = u ? (u.full_name ?? u.email ?? null) : null;
    const phoneFromUser = u?.phone ?? null;
    const byVendorId = b.vendor_id ? vendorsById.get(String(b.vendor_id)) : null;
    const byVendorName = resolveVendorSlugFromName(b.vendor_name, dbVendors);
    const billVendorSlug = (byVendorId ?? byVendorName ?? null) as string | null;
    return {
      ...b,
      vendor_slug: billVendorSlug,
      customer_name: b.customer_name ?? nameFromUser,
      customer_phone: b.customer_phone ?? phoneFromUser,
      user_email: u?.email ?? null,
      user_display_id: u?.display_id ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    bills: rows,
    page,
    limit,
    total: totalCount,
    total_pages: Math.ceil(totalCount / limit),
  });
}

