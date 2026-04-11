import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';

/**
 * Daily cleanup: delete orders still awaiting pickup (scheduled / agent_assigned)
 * with no active vendor bill, created more than 7 days ago.
 *
 * Schedule via Vercel Cron (see vercel.json). Set CRON_SECRET in env; send
 *   Authorization: Bearer <CRON_SECRET>
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = request.headers.get('x-cron-secret')?.trim() ?? '';
  if (bearer !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { data, error } = await supabase.rpc('purge_orders_no_bill_after_days', { p_days: 7 });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleted = typeof data === 'number' ? data : Number(data ?? 0);
  return NextResponse.json({ ok: true, deleted_orders: deleted });
}
