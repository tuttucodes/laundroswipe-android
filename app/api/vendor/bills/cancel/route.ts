import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

const CANCEL_WINDOW_MS = 60 * 60 * 1000;

function resolveVendorSlugFromName(vendorName: string | null | undefined): string | null {
  const normalized = String(vendorName ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const match = VENDORS.find((vendor) => {
    const candidate = vendor.name.toLowerCase();
    return normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized);
  });
  return match?.id ?? null;
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: { bill_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const billId = String(body.bill_id ?? '').trim();
  if (!billId) return NextResponse.json({ error: 'bill_id is required' }, { status: 400 });

  const { data: bill, error: fetchErr } = await supabase
    .from('vendor_bills')
    .select('id, vendor_id, vendor_name, created_at, cancelled_at')
    .eq('id', billId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  if (bill.cancelled_at) return NextResponse.json({ error: 'Bill already cancelled' }, { status: 400 });

  if (session.role === 'vendor') {
    const { data: dbVendors } = await supabase.from('vendors').select('id, slug, name');
    const byVendorId = (dbVendors ?? []).find((v: any) => String(v.id) === String(bill.vendor_id ?? ''));
    const byVendorName = resolveVendorSlugFromName(bill.vendor_name);
    const billVendorSlug = (byVendorId?.slug ?? byVendorName ?? null) as string | null;
    const sessionVendorSlug = String(session.vendorId ?? '').toLowerCase().trim();
    if (!billVendorSlug || billVendorSlug !== sessionVendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const createdAtMs = new Date(String(bill.created_at)).getTime();
  if (!Number.isFinite(createdAtMs)) return NextResponse.json({ error: 'Invalid bill timestamp' }, { status: 400 });
  if (Date.now() - createdAtMs > CANCEL_WINDOW_MS) {
    return NextResponse.json({ error: 'Cancellation window expired (1 hour)' }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from('vendor_bills')
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by_role: session.role,
    })
    .eq('id', billId)
    .is('cancelled_at', null);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

