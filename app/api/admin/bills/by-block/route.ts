import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';

type BillByBlock = {
  block: string;
  count: number;
  amount: number;
};

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const vendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  let query = supabase
    .from('vendor_bills')
    .select('customer_hostel_block, total');

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

  // Group by block
  const billsByBlock = new Map<string, { count: number; amount: number }>();
  for (const bill of bills) {
    const block = bill.customer_hostel_block || 'No hostel block';
    const existing = billsByBlock.get(block) || { count: 0, amount: 0 };
    billsByBlock.set(block, {
      count: existing.count + 1,
      amount: existing.amount + Number(bill.total ?? 0),
    });
  }

  const data: BillByBlock[] = Array.from(billsByBlock.entries())
    .map(([block, { count, amount }]) => ({
      block,
      count,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => {
      // Sort so "No hostel block" comes last
      if (a.block === 'No hostel block') return 1;
      if (b.block === 'No hostel block') return -1;
      return a.block.localeCompare(b.block);
    });

  return NextResponse.json({ bills_by_block: data });
}
