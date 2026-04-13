import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { orderLookupTokenVariants, stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';

function normalizeToken(token: string): string {
  return stripLeadingHashesFromToken(String(token ?? '')).trim();
}

function resolveVendorSlugFromOrderVendorName(orderVendorName: string | null | undefined): string | null {
  const v = (orderVendorName ?? '').toLowerCase();
  if (!v) return null;
  const match = VENDORS.find((x) => v.includes(x.name.toLowerCase()) || v === x.name.toLowerCase());
  return match?.id ?? null;
}

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: { token?: string; comments?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const token = normalizeToken(body.token ?? '');
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const tokenVariants = orderLookupTokenVariants(body.token ?? '');
  if (!tokenVariants.length) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const { data: orderRow, error: orderErr } = await supabase
    .from('orders')
    .select('id, token, status, delivery_confirmed_at, delivery_comments, vendor_name, user_id')
    .in('token', tokenVariants)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });
  const order = orderRow as Record<string, unknown> | null;
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (session.role === 'vendor') {
    const vendorSlug = session.vendorId?.toLowerCase().trim() ?? '';
    const orderVendorSlug = resolveVendorSlugFromOrderVendorName(order.vendor_name as string | null | undefined);
    if (orderVendorSlug && orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (order.status === 'delivered' && order.delivery_confirmed_at) {
    return NextResponse.json({ ok: true, order });
  }

  const comments = body.comments ? String(body.comments).trim().slice(0, 4000) : null;

  const { data: updated, error: updateErr } = await supabase
    .from('orders')
    .update({
      delivery_confirmed_at: new Date().toISOString(),
      delivery_comments: comments,
      status: 'delivered',
    })
    .eq('id', order.id as string)
    .select()
    .maybeSingle();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, order: updated });
}
