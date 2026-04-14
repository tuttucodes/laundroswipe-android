import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeScheduleDateRowsFromDb, type RawDbScheduleDateRow } from '@/lib/schedule-normalize';
import type { ScheduleSlotRow } from '@/lib/api';

/**
 * Public read of pickup schedule (same data the app used to load via Supabase anon on the client).
 * Keeps bookable dates/slots sourced from the server and one HTTP round trip for the dashboard.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Scheduling is not configured.' }, { status: 503 });
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const [slotsRes, datesRes] = await Promise.all([
      supabase
        .from('schedule_slots')
        .select('id, label, time_from, time_to, sort_order, active, created_at')
        .order('sort_order', { ascending: true }),
      supabase
        .from('schedule_dates')
        .select('date, enabled, slot_ids, enabled_by_vendor, created_at, updated_at')
        .order('date', { ascending: true }),
    ]);

    if (slotsRes.error) {
      console.error('GET /api/schedule schedule_slots', slotsRes.error);
      return NextResponse.json({ error: slotsRes.error.message }, { status: 500 });
    }
    if (datesRes.error) {
      console.error('GET /api/schedule schedule_dates', datesRes.error);
      return NextResponse.json({ error: datesRes.error.message }, { status: 500 });
    }

    const slots = (slotsRes.data ?? []) as ScheduleSlotRow[];
    const dates = normalizeScheduleDateRowsFromDb((datesRes.data ?? []) as RawDbScheduleDateRow[]);

    return NextResponse.json(
      { slots, dates },
      {
        headers: {
          'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=30',
        },
      }
    );
  } catch (e) {
    console.error('GET /api/schedule', e);
    return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 });
  }
}
