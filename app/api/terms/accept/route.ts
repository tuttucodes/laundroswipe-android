import { NextResponse } from 'next/server';
import { getAuthenticatedUserContext } from '@/lib/authenticated-user';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';

export async function POST(request: Request) {
  const context = await getAuthenticatedUserContext(request);
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { supabase, authUserId } = context;

  const { data: updated, error } = await supabase
    .from('users')
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: CURRENT_TERMS_VERSION,
    })
    .eq('auth_id', authUserId)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!updated) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  return NextResponse.json({ ok: true, user: updated });
}
