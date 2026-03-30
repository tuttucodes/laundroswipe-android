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
    .select('id, order_id, order_token, order_number, customer_name, customer_phone, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).filter((b: any) => {
    if (!vendorSlug) return true;
    const bySlug = resolveVendorSlugFromName(b.vendor_name);
    return String(bySlug ?? '').toLowerCase() === vendorSlug;
  });

  return NextResponse.json({ ok: true, bills: rows });
}

