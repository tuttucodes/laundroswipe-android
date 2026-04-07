import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';

type BillByDate = {
  date: string;
  count: number;
  amount: number;
};

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from/to parameters' }, { status: 400 });
  }

  const vendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  let query = supabase
    .from('vendor_bills')
    .select('total, created_at');

  // Filter by date range
  query = query
    .gte('created_at', from)
    .lte('created_at', to);

  if (vendorSlug) {
    const vendorsRes = await supabase
      .from('vendors')
      .select('id')
      .eq('slug', vendorSlug)
      .single();
    if (vendorsRes.error || !vendorsRes.data) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }
    query = query.eq('vendor_id', vendorsRes.data.id);
  }

  const result = await query;
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  const bills = result.data ?? [];

  // Group by date
  const billsByDate = new Map<string, { count: number; amount: number }>();
  for (const bill of bills) {
    const date = new Date(bill.created_at).toISOString().split('T')[0];
    const existing = billsByDate.get(date) || { count: 0, amount: 0 };
    billsByDate.set(date, {
      count: existing.count + 1,
      amount: existing.amount + Number(bill.total ?? 0),
    });
  }

  const data: BillByDate[] = Array.from(billsByDate.entries())
    .map(([date, { count, amount }]) => ({
      date,
      count,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({ bills_by_date: data });
}
