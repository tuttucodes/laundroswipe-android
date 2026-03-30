import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase-service';
import { getAdminSessionFromRequest } from '@/lib/admin-session';

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('location_requests')
    .select('id, created_at, location_text, lat, lng, contact_email, source')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('admin location_requests', error);
    return NextResponse.json(
      { error: error.message, hint: 'Ensure migration 20260317_create_location_requests.sql is applied.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ requests: data ?? [] });
}
