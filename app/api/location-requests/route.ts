import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkBodySize } from '@/lib/rate-limit';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

type Payload = {
  locationText?: string;
  lat?: number | null;
  lng?: number | null;
  contactEmail?: string | null;
};

export async function POST(request: Request) {
  if (!checkBodySize(request)) {
    return NextResponse.json({ ok: false, error: 'Request too large' }, { status: 413 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 503 });
  }

  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  const locationText = String(body.locationText ?? '').trim().slice(0, 500);
  if (!locationText) {
    return NextResponse.json({ ok: false, error: 'Location is required' }, { status: 400 });
  }

  const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === 'number' && Number.isFinite(body.lng) ? body.lng : null;
  let contactEmail: string | null = null;
  if (typeof body.contactEmail === 'string') {
    const em = body.contactEmail.trim().slice(0, 320);
    contactEmail = em || null;
  }

  try {
    const { error } = await supabase.from('location_requests').insert({
      location_text: locationText,
      lat,
      lng,
      contact_email: contactEmail,
      source: 'web_homepage',
    });
    if (error) {
      console.error('location-requests insert error', error);
      return NextResponse.json({ ok: false, error: 'Failed to save request' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('location-requests exception', e);
    return NextResponse.json({ ok: false, error: 'Failed to save request' }, { status: 500 });
  }
}

