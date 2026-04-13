import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAuthenticatedUserContext } from '@/lib/authenticated-user';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';

const BILL_SELECT =
  'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, vendor_slug, cancelled_at, cancelled_by_role, created_at';

type BillRow = Record<string, unknown>;

function normBillToken(v: unknown): string {
  return stripLeadingHashesFromToken(String(v ?? '')).toLowerCase();
}

/**
 * Match bills by `order_token` + ownership only (no `order_id` on bills — avoids bad / null links).
 * - `allowedTokens` comes from `orders.token` where `orders.user_id` = this profile.
 * - Reject if `vendor_bills.user_id` is set and is not this user.
 */
function billFromTokenVerifiedForProfile(bill: BillRow, profileId: string, allowedTokens: Set<string>): boolean {
  const btok = normBillToken(bill.order_token);
  if (!allowedTokens.has(btok)) return false;
  const uid = bill.user_id != null && bill.user_id !== '' ? String(bill.user_id) : '';
  if (uid && uid !== profileId) return false;
  return true;
}

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
    .select('token')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

  // Bills by token: tokens only from this user's orders (`orders.user_id`); bill rows checked with `vendor_bills.user_id`.
  const allowedTokens = new Set<string>();
  for (const o of orders ?? []) {
    const k = normBillToken((o as { token?: string }).token);
    if (k) allowedTokens.add(k);
  }
  for (const k of allowedTokens) {
    const { data: byTok, error: btErr } = await service
      .from('vendor_bills')
      .select(BILL_SELECT)
      .ilike('order_token', k)
      .is('cancelled_at', null)
      .limit(50);
    if (btErr) return NextResponse.json({ error: btErr.message }, { status: 500 });
    if (!byTok?.length) continue;
    for (const row of byTok) {
      if (billFromTokenVerifiedForProfile(row, profileId, allowedTokens)) {
        collected.push(row);
      }
    }
  }

  const bills = mergeByIdSort(collected);
  return NextResponse.json({ ok: true, profile_id: profileId, bills });
}
