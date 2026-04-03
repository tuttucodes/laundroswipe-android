import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

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

  const vendorSlug = session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? '' : '';
  const { data: vendorsData, error: vendorsError } = await supabase
    .from('vendors')
    .select('id, slug, name');
  if (vendorsError) return NextResponse.json({ error: vendorsError.message }, { status: 500 });
  const dbVendors = (vendorsData ?? []) as DbVendor[];
  const vendorsById = new Map<string, string>(dbVendors.map((v) => [String(v.id), v.slug]));

  let data: any[] | null = null;
  let error: { message: string; code?: string } | null = null;
  const withCancelCols = await supabase
    .from('vendor_bills')
    .select(
      'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, created_at, cancelled_at, cancelled_by_role',
    )
    .order('created_at', { ascending: false });
  data = withCancelCols.data as any[] | null;
  error = withCancelCols.error as { message: string; code?: string } | null;
  if (error?.code === '42703') {
    const fallback = await supabase
      .from('vendor_bills')
      .select('id, order_id, order_token, order_number, customer_name, customer_phone, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, created_at')
      .order('created_at', { ascending: false });
    data = ((fallback.data as any[] | null) ?? []).map((row) => ({
      ...row,
      customer_reg_no: null,
      customer_hostel_block: null,
      customer_room_number: null,
      cancelled_at: null,
      cancelled_by_role: null,
    }));
    error = fallback.error as { message: string; code?: string } | null;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const raw = (data ?? []).filter((b: any) => {
    if (!vendorSlug) return true;
    const byVendorId = b.vendor_id ? vendorsById.get(String(b.vendor_id)) : null;
    const byVendorName = resolveVendorSlugFromName(b.vendor_name, dbVendors);
    const billVendorSlug = (byVendorId ?? byVendorName ?? null) as string | null;
    return String(billVendorSlug ?? '').toLowerCase() === vendorSlug;
  });

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

  return NextResponse.json({ ok: true, bills: rows });
}

