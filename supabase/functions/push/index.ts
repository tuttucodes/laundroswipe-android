// Supabase Edge Function: send push via Expo when user_notifications row is inserted.
// Configure a Database Webhook: table user_notifications, event Insert, target this function.
// Set EXPO_ACCESS_TOKEN in Supabase secrets (from Expo Access Token settings, with "Enhanced Security for Push" if desired).

import { createClient } from 'npm:@supabase/supabase-js@2';

interface UserNotificationRecord {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: UserNotificationRecord;
  schema: string;
  old_record: UserNotificationRecord | null;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendExpoPush(tokens: string[], title: string, body: string): Promise<unknown> {
  if (!expoAccessToken) {
    console.error('EXPO_ACCESS_TOKEN not set');
    return { error: 'Push not configured' };
  }
  const messages = tokens.map((to) => ({
    to,
    sound: 'default' as const,
    title: title || 'LaundroSwipe',
    body: body || '',
  }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${expoAccessToken}`,
    },
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (payload.type !== 'INSERT' || payload.table !== 'user_notifications') {
    return new Response(JSON.stringify({ ok: true, skipped: 'not an insert on user_notifications' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const record = payload.record;
  const title = record.title ?? 'LaundroSwipe';
  const body = record.body ?? '';

  let tokens: string[] = [];
  if (record.user_id) {
    const { data: row, error } = await supabase
      .from('users')
      .select('expo_push_token')
      .eq('id', record.user_id)
      .maybeSingle();
    if (!error && row?.expo_push_token) {
      tokens = [row.expo_push_token];
    }
  } else {
    const { data: rows, error } = await supabase
      .from('users')
      .select('expo_push_token')
      .not('expo_push_token', 'is', null);
    if (!error && rows?.length) {
      tokens = rows.map((r: { expo_push_token: string }) => r.expo_push_token).filter(Boolean);
    }
  }

  if (tokens.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No Expo tokens' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await sendExpoPush(tokens, title, body);
  return new Response(JSON.stringify({ ok: true, sent: tokens.length, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
