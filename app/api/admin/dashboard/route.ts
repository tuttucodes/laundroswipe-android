import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';
import { fillCollectedByDate, formatIstYmd } from '@/lib/ist-dates';

function deliveryDateKeyIst(iso: string): string {
  return formatIstYmd(new Date(iso));
}

type RpcDeliveredRow = {
  delivery_date: string;
  bill_count: number;
  item_qty_sum: number;
  subtotal_sum: number;
  convenience_fee_sum: number;
  total_sum: number;
};

type RpcBlockRow = RpcDeliveredRow & { block_key: string };

function sumCollected(rows: RpcDeliveredRow[]) {
  return {
    total: Math.round(rows.reduce((s, r) => s + Number(r.total_sum), 0) * 100) / 100,
    bill_count: rows.reduce((s, r) => s + Number(r.bill_count), 0),
    item_qty_sum: Math.round(rows.reduce((s, r) => s + Number(r.item_qty_sum), 0) * 100) / 100,
    subtotal: Math.round(rows.reduce((s, r) => s + Number(r.subtotal_sum), 0) * 100) / 100,
    convenience_fee: Math.round(rows.reduce((s, r) => s + Number(r.convenience_fee_sum), 0) * 100) / 100,
  };
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(request.url);
  const blockFrom = url.searchParams.get('block_from');
  const blockTo = url.searchParams.get('block_to');

  const vendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  let vendorDbId: string | null = null;
  if (vendorSlug) {
    const vendorRes = await supabase.from('vendors').select('id').eq('slug', vendorSlug).single();
    if (vendorRes.error || !vendorRes.data) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }
    vendorDbId = vendorRes.data.id;
  }

  const now = new Date();
  const msDay = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(now.getTime() - 7 * msDay).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * msDay).toISOString();

  const istToday = formatIstYmd(now);
  const ist7Start = formatIstYmd(new Date(now.getTime() - 6 * msDay));
  const ist30Start = formatIstYmd(new Date(now.getTime() - 29 * msDay));

  // Bill-created revenue (legacy; super admin dashboard cards)
  const [rpc7d, rpc30d, del7, del30, colBlock] = await Promise.all([
    supabase.rpc('get_revenue_by_date', {
      p_group_days: 1,
      p_vendor_id: vendorDbId,
      p_from: sevenDaysAgo,
      p_to: now.toISOString(),
    }),
    supabase.rpc('get_revenue_by_date', {
      p_group_days: 1,
      p_vendor_id: vendorDbId,
      p_from: thirtyDaysAgo,
      p_to: now.toISOString(),
    }),
    supabase.rpc('get_delivered_revenue_by_date', {
      p_vendor_id: vendorDbId,
      p_from: sevenDaysAgo,
      p_to: now.toISOString(),
    }),
    supabase.rpc('get_delivered_revenue_by_date', {
      p_vendor_id: vendorDbId,
      p_from: thirtyDaysAgo,
      p_to: now.toISOString(),
    }),
    supabase.rpc('get_delivered_revenue_by_block_and_date', {
      p_vendor_id: vendorDbId,
      p_from: blockFrom ? new Date(blockFrom).toISOString() : thirtyDaysAgo,
      p_to: blockTo ? new Date(blockTo + 'T23:59:59.999Z').toISOString() : now.toISOString(),
    }),
  ]);

  // Build open tokens query (orders not yet delivered)
  let openQuery = supabase
    .from('orders')
    .select('id, status')
    .not('status', 'eq', 'delivered');

  if (vendorDbId) {
    openQuery = openQuery.eq('vendor_id', vendorDbId);
  } else if (vendorSlug) {
    const v = VENDORS.find((x) => x.id === vendorSlug);
    if (v) openQuery = (openQuery as any).ilike('vendor_name', `%${v.name}%`);
  }

  let delivered7Query = supabase
    .from('orders')
    .select('id, delivery_confirmed_at, token')
    .eq('status', 'delivered')
    .gte('delivery_confirmed_at', sevenDaysAgo);

  let delivered30Query = supabase
    .from('orders')
    .select('id, delivery_confirmed_at, token')
    .eq('status', 'delivered')
    .gte('delivery_confirmed_at', thirtyDaysAgo);

  if (vendorDbId) {
    delivered7Query = delivered7Query.eq('vendor_id', vendorDbId);
    delivered30Query = delivered30Query.eq('vendor_id', vendorDbId);
  } else if (vendorSlug) {
    const v = VENDORS.find((x) => x.id === vendorSlug);
    if (v) {
      delivered7Query = (delivered7Query as any).ilike('vendor_name', `%${v.name}%`);
      delivered30Query = (delivered30Query as any).ilike('vendor_name', `%${v.name}%`);
    }
  }

  const [openRes, deliveredRes, delivered30Res] = await Promise.all([
    openQuery,
    delivered7Query,
    delivered30Query,
  ]);

  if (openRes.error) return NextResponse.json({ error: openRes.error.message }, { status: 500 });
  if (deliveredRes.error) return NextResponse.json({ error: deliveredRes.error.message }, { status: 500 });
  if (delivered30Res.error)
    return NextResponse.json({ error: delivered30Res.error.message }, { status: 500 });

  const toRevenueBuckets = (rpcData: any[]) =>
    (rpcData ?? []).map((r: any) => ({
      date: String(r.date_from),
      bill_count: Number(r.bill_count),
      total: Math.round(Number(r.total_sum) * 100) / 100,
    }));

  const rev7dBuckets = !rpc7d.error ? toRevenueBuckets(rpc7d.data ?? []) : [];
  const rev30dBuckets = !rpc30d.error ? toRevenueBuckets(rpc30d.data ?? []) : [];

  const sumBuckets = (buckets: { total: number; bill_count: number }[]) => ({
    total: Math.round(buckets.reduce((s, b) => s + b.total, 0) * 100) / 100,
    bill_count: buckets.reduce((s, b) => s + b.bill_count, 0),
  });

  const byStatus: Record<string, number> = {};
  for (const o of openRes.data ?? []) {
    const s = String(o.status);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  function ordersDeliveredByDate(rows: { delivery_confirmed_at: string | null }[]) {
    const deliveredByDate = new Map<string, number>();
    for (const o of rows) {
      if (!o.delivery_confirmed_at) continue;
      const d = deliveryDateKeyIst(o.delivery_confirmed_at);
      deliveredByDate.set(d, (deliveredByDate.get(d) ?? 0) + 1);
    }
    return Array.from(deliveredByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const col7rows = (!del7.error ? (del7.data ?? []) : []) as RpcDeliveredRow[];
  const col30rows = (!del30.error ? (del30.data ?? []) : []) as RpcDeliveredRow[];
  if (del7.error && process.env.NODE_ENV === 'development') {
    console.warn('[dashboard] get_delivered_revenue_by_date:', del7.error.message);
  }

  const collected7Filled = fillCollectedByDate(ist7Start, istToday, col7rows);
  const collected30Filled = fillCollectedByDate(ist30Start, istToday, col30rows);

  const sum7 = sumCollected(col7rows);
  const sum30 = sumCollected(col30rows);

  const blockRows = (!colBlock.error ? (colBlock.data ?? []) : []) as RpcBlockRow[];
  const collected_by_block = blockRows.map((r) => ({
    delivery_date: String(r.delivery_date).slice(0, 10),
    block_key: String(r.block_key),
    bill_count: Number(r.bill_count),
    item_qty_sum: Math.round(Number(r.item_qty_sum) * 100) / 100,
    subtotal: Math.round(Number(r.subtotal_sum) * 100) / 100,
    convenience_fee: Math.round(Number(r.convenience_fee_sum) * 100) / 100,
    total: Math.round(Number(r.total_sum) * 100) / 100,
  }));

  return NextResponse.json({
    ok: true,
    revenue_7d: {
      ...sumBuckets(rev7dBuckets),
      by_date: rev7dBuckets.sort((a, b) => a.date.localeCompare(b.date)),
    },
    revenue_30d: {
      ...sumBuckets(rev30dBuckets),
      by_date: rev30dBuckets.sort((a, b) => a.date.localeCompare(b.date)),
    },
    collected_7d: {
      ...sum7,
      by_date: collected7Filled,
    },
    collected_30d: {
      ...sum30,
      by_date: collected30Filled,
    },
    collected_by_block,
    open_tokens: {
      count: openRes.data?.length ?? 0,
      by_status: byStatus,
    },
    delivered_7d: {
      count: deliveredRes.data?.length ?? 0,
      by_date: ordersDeliveredByDate(deliveredRes.data ?? []),
    },
    delivered_30d: {
      count: delivered30Res.data?.length ?? 0,
      by_date: ordersDeliveredByDate(delivered30Res.data ?? []),
    },
  });
}
