import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

const STATUSES = [
  'scheduled',
  'agent_assigned',
  'picked_up',
  'processing',
  'ready',
  'out_for_delivery',
  'delivered',
] as const;

function resolveVendorSlugFromName(vendorName: string | null | undefined): string | null {
  const v = (vendorName ?? '').toLowerCase();
  if (!v) return null;
  const match = VENDORS.find((x) => v.includes(x.name.toLowerCase()) || v === x.name.toLowerCase());
  return match?.id ?? null;
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const orderId = String(body.orderId ?? '').trim();
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

  // Fetch current order first (so we can validate vendor access and compute next status).
  const { data: existing, error: existingErr } = await supabase
    .from('orders')
    .select(
      'id, status, vendor_id, vendor_name'
    )
    .eq('id', orderId)
    .maybeSingle();
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (session.role === 'vendor') {
    const vendorSlug = session.vendorId?.toLowerCase().trim() ?? '';
    const orderVendorSlug = resolveVendorSlugFromName((existing as any).vendor_name) ?? '';
    if (orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const currentIdx = STATUSES.indexOf(existing.status as (typeof STATUSES)[number]);
  if (currentIdx < 0 || currentIdx >= STATUSES.length - 1) {
    return NextResponse.json({ ok: true, order: existing }, { status: 200 });
  }

  const nextStatus = STATUSES[currentIdx + 1];

  const { data, error } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, order: data });
}

