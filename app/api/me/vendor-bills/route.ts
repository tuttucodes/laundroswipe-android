import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAuthenticatedUserContext } from '@/lib/authenticated-user';
import { orderLookupTokenVariants, stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';

const BILL_SELECT =
  'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, vendor_slug, cancelled_at, cancelled_by_role, created_at';

type BillRow = Record<string, unknown>;

function debugLog(payload: {
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
}): void {
  // #region agent log
  fetch('http://127.0.0.1:7428/ingest/c02f407f-c764-45c0-ab87-69194259e7eb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2ac42a' },
    body: JSON.stringify({
      sessionId: '2ac42a',
      ...payload,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function normBillToken(v: unknown): string {
  return stripLeadingHashesFromToken(String(v ?? '')).toLowerCase();
}

function billFromTokenVerifiedForCandidates(
  bill: BillRow,
  candidateUserIds: Set<string>,
  allowedTokens: Set<string>
): boolean {
  const btok = normBillToken(bill.order_token);
  if (!allowedTokens.has(btok)) return false;
  const uid = bill.user_id != null && bill.user_id !== '' ? String(bill.user_id) : '';
  if (uid && !candidateUserIds.has(uid)) return false;
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

async function resolveProfileId(service: SupabaseClient, authUserId: string): Promise<string | null> {
  // Primary path: deployments that bind users.id directly to auth.uid().
  const byId = await service.from('users').select('id').eq('id', authUserId).limit(1);
  if (byId.error && byId.error.code !== 'PGRST116') throw byId.error;
  const byIdRow = Array.isArray(byId.data) ? byId.data[0] : null;
  if (byIdRow?.id) return String(byIdRow.id);

  // Compatibility path: older deployments that still use users.auth_id mapping.
  const byAuthId = await service.from('users').select('id').eq('auth_id', authUserId).limit(1);
  if (byAuthId.error) {
    // Column missing in schema: treat as id-only deployment.
    if (byAuthId.error.code === '42703') return null;
    throw byAuthId.error;
  }
  const byAuthRow = Array.isArray(byAuthId.data) ? byAuthId.data[0] : null;
  if (byAuthRow?.id) return String(byAuthRow.id);
  return null;
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

  const candidateUserIds = new Set<string>([authUserId]);
  let profileId: string | null = null;
  try {
    const resolvedProfileId = await resolveProfileId(service, authUserId);
    if (resolvedProfileId) {
      profileId = resolvedProfileId;
      candidateUserIds.add(resolvedProfileId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not resolve profile id';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const candidateIds = [...candidateUserIds];
  debugLog({
    runId: 'initial',
    hypothesisId: 'H1_PROFILE_MAPPING',
    location: 'app/api/me/vendor-bills/route.ts:resolve-profile',
    message: 'Resolved profile id for bill query',
    data: { authUserId, profileId, candidateIds },
  });

  const collected: BillRow[] = [];

  const { data: byUser, error: buErr } = await service
    .from('vendor_bills')
    .select(BILL_SELECT)
    .in('user_id', candidateIds)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (buErr) return NextResponse.json({ error: buErr.message }, { status: 500 });
  if (byUser?.length) collected.push(...byUser);
  debugLog({
    runId: 'initial',
    hypothesisId: 'H2_BILLS_BY_USER_EMPTY',
    location: 'app/api/me/vendor-bills/route.ts:query-by-user',
    message: 'Bills fetched by vendor_bills.user_id',
    data: { profileId, candidateIds, byUserCount: byUser?.length ?? 0 },
  });

  const { data: orders, error: ordErr } = await service
    .from('orders')
    .select('token')
    .in('user_id', candidateIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });
  debugLog({
    runId: 'initial',
    hypothesisId: 'H3_ORDERS_TOKENS_EMPTY',
    location: 'app/api/me/vendor-bills/route.ts:orders-token-source',
    message: 'Orders fetched for token matching',
    data: {
      profileId,
      candidateIds,
      ordersCount: orders?.length ?? 0,
      sampleOrderTokens: (orders ?? []).slice(0, 5).map((o) => String((o as { token?: string }).token ?? '')),
    },
  });

  // Bills by token: tokens only from this user's orders (`orders.user_id`); bill rows checked with `vendor_bills.user_id`.
  const allowedTokens = new Set<string>();
  for (const o of orders ?? []) {
    const k = normBillToken((o as { token?: string }).token);
    if (k) allowedTokens.add(k);
  }
  debugLog({
    runId: 'initial',
    hypothesisId: 'H4_TOKEN_NORMALIZATION_MISMATCH',
    location: 'app/api/me/vendor-bills/route.ts:token-normalization',
    message: 'Normalized allowed tokens prepared from orders',
    data: { allowedTokenCount: allowedTokens.size, sampleAllowedTokens: [...allowedTokens].slice(0, 5) },
  });

  let byTokenFetchedCount = 0;
  let byTokenAcceptedCount = 0;
  for (const k of allowedTokens) {
    const tokenVariants = orderLookupTokenVariants(k);
    if (!tokenVariants.length) continue;
    const { data: byTok, error: btErr } = await service
      .from('vendor_bills')
      .select(BILL_SELECT)
      .in('order_token', tokenVariants)
      .is('cancelled_at', null)
      .limit(50);
    if (btErr) return NextResponse.json({ error: btErr.message }, { status: 500 });
    if (!byTok?.length) continue;
    byTokenFetchedCount += byTok.length;
    for (const row of byTok) {
      if (billFromTokenVerifiedForCandidates(row, candidateUserIds, allowedTokens)) {
        collected.push(row);
        byTokenAcceptedCount += 1;
      }
    }
  }

  const bills = mergeByIdSort(collected);
  debugLog({
    runId: 'initial',
    hypothesisId: 'H5_TOKEN_FILTER_REJECTS_VALID_BILLS',
    location: 'app/api/me/vendor-bills/route.ts:final-merge',
    message: 'Final bill merge statistics',
    data: {
      byUserCount: byUser?.length ?? 0,
      byTokenFetchedCount,
      byTokenAcceptedCount,
      mergedCount: bills.length,
      candidateIds,
    },
  });
  return NextResponse.json({ ok: true, profile_id: profileId, candidate_ids: candidateIds, bills });
}
