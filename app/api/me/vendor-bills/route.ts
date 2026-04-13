import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAuthenticatedUserContext } from '@/lib/authenticated-user';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';

const BILL_SELECT =
  'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, vendor_slug, cancelled_at, cancelled_by_role, created_at';

type BillRow = Record<string, unknown>;

function mergeByIdSort(rows: BillRow[]): BillRow[] {
  const byId = new Map<string, BillRow>();
  for (const r of rows) {
    const id = r?.id;
    if (typeof id === 'string') byId.set(id, r);
  }
  return [...byId.values()]
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, 200);
}

/**
 * Returns vendor bills for the signed-in user (JWT), using service role so this works
 * even when client-side RLS on `vendor_bills` is too strict or migrations were not applied yet.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUserContext(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });

  const authUserId = auth.authUserId;

  const { data: userRows, error: userErr } = await service
    .from('users')
    .select('id')
    .or(`id.eq.${authUserId},auth_id.eq.${authUserId}`)
    .limit(1);

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  const userRow = Array.isArray(userRows) ? userRows[0] : null;
  if (!userRow?.id) return NextResponse.json({ ok: true, profile_id: null, bills: [] });

  const profileId = String(userRow.id);

  const collected: BillRow[] = [];

  const { data: byUser, error: buErr } = await service
    .from('vendor_bills')
    .select(BILL_SELECT)
    .eq('user_id', profileId)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (buErr) return NextResponse.json({ error: buErr.message }, { status: 500 });
  if (byUser?.length) collected.push(...byUser);

  const { data: orders, error: ordErr } = await service
    .from('orders')
    .select('id, token')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

  const orderIds = (orders ?? []).map((o) => o.id).filter(Boolean) as string[];
  const chunkSize = 80;
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const { data: byOrder, error: boErr } = await service
      .from('vendor_bills')
      .select(BILL_SELECT)
      .in('order_id', chunk)
      .is('cancelled_at', null);
    if (boErr) return NextResponse.json({ error: boErr.message }, { status: 500 });
    if (byOrder?.length) collected.push(...byOrder);
  }

  // Bills tied by token only (order_id null, or legacy / dedup rows) — same tokens as this user's orders.
  const tokenKeys = new Set<string>();
  for (const o of orders ?? []) {
    const t = typeof (o as { token?: string }).token === 'string' ? stripLeadingHashesFromToken((o as { token: string }).token) : '';
    const k = t.toLowerCase();
    if (k) tokenKeys.add(k);
  }
  for (const k of tokenKeys) {
    const { data: byTok, error: btErr } = await service
      .from('vendor_bills')
      .select(BILL_SELECT)
      .ilike('order_token', k)
      .is('cancelled_at', null)
      .limit(50);
    if (btErr) return NextResponse.json({ error: btErr.message }, { status: 500 });
    if (byTok?.length) collected.push(...byTok);
  }

  const bills = mergeByIdSort(collected);
  return NextResponse.json({ ok: true, profile_id: profileId, bills });
}
