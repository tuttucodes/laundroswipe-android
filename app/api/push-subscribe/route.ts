// Register Expo push token for the current user (called from the Expo mobile app).
// Body: { expo_push_token: string }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkPublicRateLimit } from '@/lib/public-rate-limit';

const MAX_BODY = 2 * 1024; // 2KB

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  const rate = checkPublicRateLimit({
    request,
    keyPrefix: 'public:push-subscribe',
    windowMs: 60 * 60 * 1000,
    maxRequests: 60,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  }

  let body: { expo_push_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const expoPushToken = typeof body?.expo_push_token === 'string' ? body.expo_push_token.trim() : '';
  if (!expoPushToken) return NextResponse.json({ error: 'Missing expo_push_token' }, { status: 400 });
  if (expoPushToken.length > 500) return NextResponse.json({ error: 'expo_push_token too long' }, { status: 400 });

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !authUser?.id) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { error: updateError } = await supabase
    .from('users')
    .update({ expo_push_token: expoPushToken })
    .eq('auth_id', authUser.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
