import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VIT_VENDOR_BLOCK_ACCESS, VENDORS } from '@/lib/constants';

function normalizeToken(token: string): string {
  return String(token).replace(/^#/, '').trim();
}

function resolveVendorSlugFromOrderVendorName(orderVendorName: string | null | undefined): string | null {
  const v = (orderVendorName ?? '').toLowerCase();
  if (!v) return null;
  const match = VENDORS.find((x) => v.includes(x.name.toLowerCase()) || v === x.name.toLowerCase());
  return match?.id ?? null;
}

function isUserAuthorizedForVendor(vendorSlug: string, user: any | null): boolean {
  if (!user) return false;
  const collegeId = String(user.college_id ?? '').toLowerCase();
  if (collegeId !== 'vit-chn') return false;
  const allowedBlocks = (VIT_VENDOR_BLOCK_ACCESS as any)[vendorSlug] as string[] | undefined;
  if (!allowedBlocks?.length) return false;
  const block = String(user.hostel_block ?? '').trim().toUpperCase();
  return allowedBlocks.some((b) => block.startsWith(b));
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

  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('id, token, status, delivery_confirmed_at, delivery_comments, vendor_name, user_id')
    .eq('token', token)
    .limit(1)
    .maybeSingle();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });
  const order = orders as any;
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (session.role === 'vendor') {
    const vendorSlug = session.vendorId?.toLowerCase().trim() ?? '';
    const orderVendorSlug = resolveVendorSlugFromOrderVendorName(order.vendor_name);
    if (orderVendorSlug && orderVendorSlug !== vendorSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (order.user_id) {
      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .select('college_id, hostel_block')
        .eq('id', order.user_id)
        .maybeSingle();
      if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
      if (!isUserAuthorizedForVendor(vendorSlug, userRow ?? null)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
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
    .eq('id', order.id)
    .select()
    .maybeSingle();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, order: updated });
}

