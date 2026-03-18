import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkBodySize } from '@/lib/rate-limit';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  if (!checkBodySize(request)) {
    return NextResponse.json({ ok: false, error: 'Request too large' }, { status: 413 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 503 });
  }

  let body: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
    role?: string;
    institution?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 320) : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 250) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  const role = typeof body.role === 'string' ? body.role.trim().slice(0, 60) : '';
  const institution =
    typeof body.institution === 'string' ? body.institution.trim().slice(0, 250) : '';

  if (!name || !email || !message) {
    return NextResponse.json(
      { ok: false, error: 'Name, email, and message are required' },
      { status: 400 },
    );
  }

  try {
    const { error } = await supabase.from('contact_messages').insert({
      name,
      email,
      subject: subject || null,
      message,
      role: role || null,
      institution: institution || null,
      source: 'web_homepage',
    });

    if (error) {
      console.error('contact_messages insert error', error);
      return NextResponse.json(
        { ok: false, error: error.message || 'Failed to send message' },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('contact_messages insert exception', e);
    return NextResponse.json({ ok: false, error: 'Failed to send message' }, { status: 500 });
  }
}

