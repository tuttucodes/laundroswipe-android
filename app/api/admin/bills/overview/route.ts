import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const vendorSlug =
    session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;

  let query = supabase
    .from('vendor_bills')
    .select('id', { count: 'exact' });

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

  return NextResponse.json({
    total_count: result.count ?? 0,
  });
}
