import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSessionCookie, verifyAdminToken } from '@/lib/admin-session';
import type { ScheduleSlotRow, ScheduleDateRow } from '@/lib/api';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

function isAdmin(request: Request): boolean {
  const cookie = getAdminSessionCookie(request);
  return verifyAdminToken(cookie) !== null;
}

export async function GET() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const [slotsRes, datesRes] = await Promise.all([
      supabase.from('schedule_slots').select('*').order('sort_order', { ascending: true }),
      supabase.from('schedule_dates').select('*').order('date', { ascending: true }),
    ]);
    if (slotsRes.error) return NextResponse.json({ error: slotsRes.error.message }, { status: 500 });
    if (datesRes.error) return NextResponse.json({ error: datesRes.error.message }, { status: 500 });
    const slots = (slotsRes.data ?? []) as ScheduleSlotRow[];
    const dates = (datesRes.data ?? []).map((r: ScheduleDateRow & { slot_ids?: unknown }) => ({
      ...r,
      slot_ids: Array.isArray(r.slot_ids) ? r.slot_ids : [],
    }));
    return NextResponse.json({ slots, dates });
  } catch (e) {
    console.error('GET /api/admin/schedule', e);
    return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 });
  }
}

type SchedulePayload = {
  slots?: Array<{
    id: string;
    label: string;
    time_from: string;
    time_to: string;
    sort_order: number;
    active: boolean;
  }>;
  dates?: Array<{
    date: string;
    enabled: boolean;
    slot_ids: string[];
  }>;
};

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  let body: SchedulePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  try {
    if (body.slots != null && Array.isArray(body.slots)) {
      for (const row of body.slots) {
        const id = String(row?.id ?? '').trim();
        if (!id) continue;
        const { error } = await supabase
          .from('schedule_slots')
          .upsert(
            {
              id,
              label: String(row.label ?? '').trim() || row.id,
              time_from: String(row.time_from ?? '00:00').trim(),
              time_to: String(row.time_to ?? '23:59').trim(),
              sort_order: Number(row.sort_order) || 0,
              active: Boolean(row.active),
            },
            { onConflict: 'id' }
          );
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    if (body.dates != null && Array.isArray(body.dates)) {
      for (const row of body.dates) {
        const dateStr = String(row?.date ?? '').trim();
        if (!dateStr) continue;
        const { error } = await supabase
          .from('schedule_dates')
          .upsert(
            {
              date: dateStr,
              enabled: Boolean(row.enabled),
              slot_ids: Array.isArray(row.slot_ids) ? row.slot_ids : [],
            },
            { onConflict: 'date' }
          );
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/schedule', e);
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
  }
}
