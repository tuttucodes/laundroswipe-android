import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminRequest } from '@/lib/admin-session';
import { checkAdminRateLimit, checkBodySize } from '@/lib/rate-limit';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Flush scheduled notifications: set sent_at = now() where scheduled_at <= now() and sent_at is null */
async function flushScheduled(supabase: ReturnType<typeof getServiceSupabase>) {
  if (!supabase) return;
  await supabase
    .from('user_notifications')
    .update({ sent_at: new Date().toISOString() })
    .is('sent_at', null)
    .lte('scheduled_at', new Date().toISOString());
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  try {
    await flushScheduled(supabase);
    const { data, error } = await supabase
      .from('user_notifications')
      .select('id, user_id, title, body, sent_at, scheduled_at, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notifications: data ?? [] });
  } catch (e) {
    console.error('GET /api/admin/notifications', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

type NotifyPayload = {
  title: string;
  body?: string;
  send_now?: boolean;
  scheduled_at?: string; // ISO datetime
};

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rate = checkAdminRateLimit(request);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
    );
  }
  if (!checkBodySize(request)) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  let body: NotifyPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const title = String(body?.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: 'Title too long' }, { status: 400 });
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';
  if (bodyText.length > 5000) return NextResponse.json({ error: 'Body too long' }, { status: 400 });
  const sendNow = body.send_now !== false;
  const scheduledAt = body.scheduled_at ? String(body.scheduled_at).trim() : null;
  const sentAt = sendNow && !scheduledAt ? new Date().toISOString() : null;
  try {
    const { error } = await supabase.from('user_notifications').insert({
      user_id: null,
      title,
      body: bodyText || null,
      sent_at: sentAt,
      scheduled_at: scheduledAt || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await flushScheduled(supabase);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/notifications', e);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
