import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';
import { VENDORS } from '@/lib/constants';

type DeliveredByDate = {
  date: string;
  order_count: number;
  total_items: number;
  total_amount: number;
};

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const vendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  // Build delivered orders query
  let ordersQuery = supabase
    .from('orders')
    .select('token, delivery_confirmed_at, created_at')
    .eq('status', 'delivered')
    .order('delivery_confirmed_at', { ascending: false })
    .limit(500);

  if (vendorSlug) {
    const vendor = VENDORS.find((v) => v.id === vendorSlug);
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    ordersQuery = ordersQuery.ilike('vendor_name', `%${vendor.name}%`);
  }

  const { data: orders, error: ordersErr } = await ordersQuery;
  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });
  if (!orders || orders.length === 0) {
    return NextResponse.json({ delivered_by_date: [] });
  }

  const tokens = orders.map((o) => o.token).filter(Boolean);

  // Fetch vendor_bills for delivered order tokens to get items/amounts
  let billsQuery = supabase
    .from('vendor_bills')
    .select('order_token, line_items, total')
    .in('order_token', tokens);

  if (vendorSlug) {
    const vendorsRes = await supabase
      .from('vendors')
      .select('id')
      .eq('slug', vendorSlug)
      .single();
    if (!vendorsRes.error && vendorsRes.data) {
      billsQuery = billsQuery.eq('vendor_id', vendorsRes.data.id);
    }
  }

  const { data: bills, error: billsErr } = await billsQuery;
  if (billsErr) return NextResponse.json({ error: billsErr.message }, { status: 500 });

  // Index bills by order_token for O(1) lookup
  const billByToken = new Map<string, { total_items: number; total: number }>();
  for (const bill of bills ?? []) {
    const items = Array.isArray(bill.line_items)
      ? (bill.line_items as Array<{ qty?: number }>).reduce((s, i) => s + (Number(i.qty) || 0), 0)
      : 0;
    const existing = billByToken.get(bill.order_token);
    if (existing) {
      existing.total_items += items;
      existing.total += Number(bill.total ?? 0);
    } else {
      billByToken.set(bill.order_token, { total_items: items, total: Number(bill.total ?? 0) });
    }
  }

  // Group delivered orders by delivery date
  const byDate = new Map<string, { order_count: number; total_items: number; total_amount: number }>();
  for (const order of orders) {
    const rawDate = order.delivery_confirmed_at ?? order.created_at;
    const date = new Date(rawDate).toISOString().split('T')[0];
    const bill = billByToken.get(order.token);
    const existing = byDate.get(date) ?? { order_count: 0, total_items: 0, total_amount: 0 };
    byDate.set(date, {
      order_count: existing.order_count + 1,
      total_items: existing.total_items + (bill?.total_items ?? 0),
      total_amount: existing.total_amount + (bill?.total ?? 0),
    });
  }

  const delivered_by_date: DeliveredByDate[] = Array.from(byDate.entries())
    .map(([date, d]) => ({
      date,
      order_count: d.order_count,
      total_items: d.total_items,
      total_amount: Math.round(d.total_amount * 100) / 100,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ delivered_by_date });
}
