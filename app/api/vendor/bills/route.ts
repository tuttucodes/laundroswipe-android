import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

function resolveVendorSlugFromName(vendorName: string | null | undefined): string | null {
  const v = (vendorName ?? '').toLowerCase();
  if (!v) return null;
  const match = VENDORS.find((x) => v.includes(x.name.toLowerCase()) || v === x.name.toLowerCase());
  return match?.id ?? null;
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const vendorSlug = session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? '' : '';

  const { data, error } = await supabase
    .from('vendor_bills')
    .select('id, order_id, order_token, order_number, customer_name, customer_phone, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, created_at, cancelled_at, cancelled_by_role')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const raw = (data ?? []).filter((b: any) => {
    if (!vendorSlug) return true;
    const bySlug = resolveVendorSlugFromName(b.vendor_name);
    return String(bySlug ?? '').toLowerCase() === vendorSlug;
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
    return {
      ...b,
      customer_name: b.customer_name ?? nameFromUser,
      customer_phone: b.customer_phone ?? phoneFromUser,
      user_email: u?.email ?? null,
      user_display_id: u?.display_id ?? null,
    };
  });

  return NextResponse.json({ ok: true, bills: rows });
}

