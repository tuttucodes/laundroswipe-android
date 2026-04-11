import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { fillCollectedByDate, formatIstYmd, istYmdEndIso, istYmdStartIso } from '@/lib/ist-dates';

/**
 * Delivery-based revenue for scripts / external tools.
 * Example: GET /api/admin/analytics/delivered?days=30
 * Optional: from=YYYY-MM-DD&to=YYYY-MM-DD (overrides days)
 */
export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(request.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10)));

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
  let pFrom: string;
  let pTo: string;
  let istStart: string;
  let istEnd: string;

  if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    pFrom = istYmdStartIso(fromParam);
    pTo = istYmdEndIso(toParam);
    istStart = fromParam;
    istEnd = toParam;
  } else {
    pFrom = new Date(now.getTime() - days * msDay).toISOString();
    pTo = now.toISOString();
    istEnd = formatIstYmd(now);
    istStart = formatIstYmd(new Date(now.getTime() - (days - 1) * msDay));
  }

  const [byDate, byBlock] = await Promise.all([
    supabase.rpc('get_delivered_revenue_by_date', {
      p_vendor_id: vendorDbId,
      p_from: pFrom,
      p_to: pTo,
    }),
    supabase.rpc('get_delivered_revenue_by_block_and_date', {
      p_vendor_id: vendorDbId,
      p_from: pFrom,
      p_to: pTo,
    }),
  ]);

  if (byDate.error) return NextResponse.json({ error: byDate.error.message }, { status: 500 });
  if (byBlock.error) return NextResponse.json({ error: byBlock.error.message }, { status: 500 });

  const rows = (byDate.data ?? []) as Array<{
    delivery_date: string;
    bill_count: number;
    item_qty_sum: number;
    subtotal_sum: number;
    convenience_fee_sum: number;
    total_sum: number;
  }>;

  const filled = fillCollectedByDate(istStart, istEnd, rows);
  const summary = {
    bill_count: rows.reduce((s, r) => s + Number(r.bill_count), 0),
    item_qty_sum: Math.round(rows.reduce((s, r) => s + Number(r.item_qty_sum), 0) * 100) / 100,
    total: Math.round(rows.reduce((s, r) => s + Number(r.total_sum), 0) * 100) / 100,
    subtotal: Math.round(rows.reduce((s, r) => s + Number(r.subtotal_sum), 0) * 100) / 100,
    convenience_fee: Math.round(rows.reduce((s, r) => s + Number(r.convenience_fee_sum), 0) * 100) / 100,
  };

  const blockRows = (byBlock.data ?? []) as Array<{
    delivery_date: string;
    block_key: string;
    bill_count: number;
    item_qty_sum: number;
    total_sum: number;
  }>;

  return NextResponse.json({
    ok: true,
    summary,
    by_date: filled,
    by_block_by_date: blockRows.map((r) => ({
      date: String(r.delivery_date).slice(0, 10),
      block: String(r.block_key),
      bill_count: Number(r.bill_count),
      item_qty_sum: Math.round(Number(r.item_qty_sum) * 100) / 100,
      total: Math.round(Number(r.total_sum) * 100) / 100,
    })),
  });
}
