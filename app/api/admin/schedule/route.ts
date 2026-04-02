import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSessionFromRequest, isAdminRequest } from '@/lib/admin-session';
import { checkAdminRateLimit, checkBodySize } from '@/lib/rate-limit';
import type { ScheduleSlotRow, ScheduleDateRow } from '@/lib/api';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

function vendorPrefix(vendorSlug: string): string {
  return `${vendorSlug}__`;
}

function toStoredSlotId(slotId: string, vendorSlug: string | null): string {
  return vendorSlug ? `${vendorPrefix(vendorSlug)}${slotId}` : slotId;
}

function fromStoredSlotId(slotId: string, vendorSlug: string | null): string {
  if (!vendorSlug) return slotId;
  const p = vendorPrefix(vendorSlug);
  return slotId.startsWith(p) ? slotId.slice(p.length) : slotId;
}

function readVendorSlotIds(raw: unknown, vendorSlug: string | null): string[] {
  if (Array.isArray(raw)) {
    const ids = raw.filter((s): s is string => typeof s === 'string');
    if (!vendorSlug) return ids;
    const p = vendorPrefix(vendorSlug);
    const vendorScoped = ids.filter((id) => id.startsWith(p)).map((id) => id.slice(p.length));
    // Legacy fallback: old global schedule arrays before vendor scoping.
    return vendorScoped.length > 0 ? vendorScoped : ids;
  }
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>;
    const key = vendorSlug ?? 'global';
    const arr = map[key];
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : [];
  }
  return [];
}

function writeVendorSlotIds(raw: unknown, vendorSlug: string | null, slotIds: string[]): Record<string, string[]> | string[] {
  if (!vendorSlug) return slotIds;
  const next: Record<string, string[]> = {};
  if (Array.isArray(raw)) {
    next.global = raw.filter((s): s is string => typeof s === 'string');
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) next[k] = v.filter((s): s is string => typeof s === 'string');
    }
  }
  next[vendorSlug] = slotIds;
  return next;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const session = getAdminSessionFromRequest(request);
  if (!session || (session.role !== 'super_admin' && session.role !== 'vendor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const vendorSlug = session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;
    const [slotsRes, datesRes] = await Promise.all([
      supabase.from('schedule_slots').select('*').order('sort_order', { ascending: true }),
      supabase.from('schedule_dates').select('*').order('date', { ascending: true }),
    ]);
    if (slotsRes.error) return NextResponse.json({ error: slotsRes.error.message }, { status: 500 });
    if (datesRes.error) return NextResponse.json({ error: datesRes.error.message }, { status: 500 });
    const allSlots = (slotsRes.data ?? []) as ScheduleSlotRow[];
    const slots = allSlots
      .filter((s) => (vendorSlug ? s.id.startsWith(vendorPrefix(vendorSlug)) : !s.id.includes('__')))
      .map((s) => ({ ...s, id: fromStoredSlotId(s.id, vendorSlug) }));
    const dates = (datesRes.data ?? []).map((r: ScheduleDateRow & { slot_ids?: unknown }) => ({
      ...r,
      slot_ids: readVendorSlotIds(r.slot_ids, vendorSlug),
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
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const session = getAdminSessionFromRequest(request);
  if (!session || (session.role !== 'super_admin' && session.role !== 'vendor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const rate = checkAdminRateLimit(request);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
    );
  }
  if (!checkBodySize(request)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
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
  if (body.slots && (!Array.isArray(body.slots) || body.slots.length > 100)) {
    return NextResponse.json({ error: 'Invalid slots payload' }, { status: 400 });
  }
  if (body.dates && (!Array.isArray(body.dates) || body.dates.length > 500)) {
    return NextResponse.json({ error: 'Invalid dates payload' }, { status: 400 });
  }

  try {
    const vendorSlug = session.role === 'vendor' ? session.vendorId?.toLowerCase().trim() ?? null : null;
    if (body.slots != null && Array.isArray(body.slots)) {
      for (const row of body.slots) {
        const clientId = String(row?.id ?? '').trim();
        const id = toStoredSlotId(clientId, vendorSlug);
        if (!id) continue;
        if (id.length > 64) return NextResponse.json({ error: 'Slot id too long' }, { status: 400 });
        const { error } = await supabase
          .from('schedule_slots')
          .upsert(
            {
              id,
              label: String(row.label ?? '').trim() || clientId,
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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        const slotIds = Array.isArray(row.slot_ids) ? row.slot_ids.filter((s): s is string => typeof s === 'string').slice(0, 20) : [];
        const storedSlotIds = slotIds.map((id) => toStoredSlotId(id, vendorSlug));
        const existing = await supabase
          .from('schedule_dates')
          .select('slot_ids')
          .eq('date', dateStr)
          .maybeSingle();
        if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 400 });
        const mergedSlotIds = writeVendorSlotIds(existing.data?.slot_ids, vendorSlug, storedSlotIds);
        const { error } = await supabase
          .from('schedule_dates')
          .upsert(
            {
              date: dateStr,
              enabled: Boolean(row.enabled),
              slot_ids: mergedSlotIds,
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
