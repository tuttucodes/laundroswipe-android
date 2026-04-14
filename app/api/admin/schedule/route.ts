/**
 * Admin schedule API — reads/writes Supabase `schedule_slots` (slot definitions) and
 * `schedule_dates` (bookable calendar + per-vendor `slot_ids` / `enabled_by_vendor` JSON).
 * All mutations use the service role client (bypasses RLS). The Schedule tab in admin
 * must call POST after edits so changes persist.
 */
import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest, isAdminRequest } from '@/lib/admin-session';
import { checkAdminRateLimit, checkBodySize } from '@/lib/rate-limit';
import type { ScheduleSlotRow, ScheduleDateRow } from '@/lib/api';
import { uniqueSlotIds } from '@/lib/schedule-slot-merge';
import { scheduleDateKey } from '@/lib/schedule-date-key';
import { createServiceSupabase } from '@/lib/supabase-service';

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
    if (!vendorSlug) return uniqueSlotIds(ids);
    const p = vendorPrefix(vendorSlug);
    const vendorScoped = ids.filter((id) => id.startsWith(p)).map((id) => id.slice(p.length));
    // Legacy fallback only when values are truly unscoped.
    const hasAnyScopedIds = ids.some((id) => id.includes('__'));
    if (vendorScoped.length > 0) return uniqueSlotIds(vendorScoped);
    return hasAnyScopedIds ? [] : uniqueSlotIds(ids);
  }
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>;
    const key = vendorSlug ?? 'global';
    const arr = map[key];
    // Vendor admin: do not fall back to `global` — leftover global slots made "deleted" dates reappear.
    return Array.isArray(arr)
      ? uniqueSlotIds(
          arr
            .filter((s): s is string => typeof s === 'string')
            .map((id) => fromStoredSlotId(id, vendorSlug)),
        )
      : [];
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

function readVendorEnabled(raw: unknown, vendorSlug: string | null, fallbackEnabled: boolean): boolean {
  if (!vendorSlug) return fallbackEnabled;
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>;
    const v = map[vendorSlug];
    if (typeof v === 'boolean') return v;
    // If vendor-scoped map exists but this vendor has no value, keep isolated by defaulting false.
    if (Object.keys(map).length > 0) return false;
  }
  return fallbackEnabled;
}

/** Drop keys whose slot list is empty so `{ "global": [] }` does not block row cleanup. */
function compactSlotIdsMap(map: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(map)) {
    if (Array.isArray(v) && v.length > 0) out[k] = v;
  }
  return out;
}

/** After prune, delete the row only when no vendor keys remain (safe for shared schedule_dates rows). */
function scheduleDateJsonMapsBare(slotMap: Record<string, unknown>, enMap: Record<string, boolean>): boolean {
  return Object.keys(slotMap).length === 0 && Object.keys(enMap).length === 0;
}

/**
 * For vendor-scoped GET, drop rows where JSON has no entry for this vendor (legacy `global`-only
 * seeds). Those rows could not be pruned on save and made “deleted” dates reappear on reload.
 */
function vendorScheduleRowVisibleForVendor(
  rawSlotIds: unknown,
  rawEnabledByVendor: unknown,
  vendorSlug: string | null,
  derivedSlotIds: string[],
  derivedEnabled: boolean,
): boolean {
  if (!vendorSlug) return true;
  if (rawSlotIds && typeof rawSlotIds === 'object' && !Array.isArray(rawSlotIds)) {
    if (Object.prototype.hasOwnProperty.call(rawSlotIds, vendorSlug)) return true;
  } else if (Array.isArray(rawSlotIds)) {
    return derivedSlotIds.length > 0 || derivedEnabled;
  }
  if (rawEnabledByVendor && typeof rawEnabledByVendor === 'object' && !Array.isArray(rawEnabledByVendor)) {
    if (Object.prototype.hasOwnProperty.call(rawEnabledByVendor, vendorSlug)) return true;
  }
  return derivedSlotIds.length > 0 || derivedEnabled;
}

function writeVendorEnabled(raw: unknown, vendorSlug: string | null, enabled: boolean): Record<string, boolean> | null {
  if (!vendorSlug) return null;
  const next: Record<string, boolean> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'boolean') next[k] = v;
    }
  }
  next[vendorSlug] = enabled;
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
  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured (SUPABASE_SERVICE_ROLE_KEY required for admin schedule)' },
      { status: 503 },
    );
  }
  try {
    const url = new URL(request.url);
    const requestedVendor = (url.searchParams.get('vendor')?.toLowerCase().trim() ?? '') || null;
    if (session.role === 'super_admin' && !requestedVendor) {
      return NextResponse.json({ error: 'vendor query parameter is required for super admin' }, { status: 400 });
    }
    const vendorSessionSlug = (session.vendorId?.toLowerCase().trim() ?? '') || null;
    const vendorSlug = session.role === 'vendor' ? vendorSessionSlug : requestedVendor;
    if (session.role === 'vendor' && !vendorSlug) {
      return NextResponse.json({ error: 'Vendor session is missing vendor id' }, { status: 403 });
    }
    const [slotsRes, datesRes] = await Promise.all([
      supabase.from('schedule_slots').select('id, label, time_from, time_to, sort_order, active, created_at').order('sort_order', { ascending: true }),
      supabase.from('schedule_dates').select('date, enabled, slot_ids, enabled_by_vendor, created_at, updated_at').order('date', { ascending: true }),
    ]);
    if (slotsRes.error) return NextResponse.json({ error: slotsRes.error.message }, { status: 500 });
    if (datesRes.error) return NextResponse.json({ error: datesRes.error.message }, { status: 500 });
    const allSlots = (slotsRes.data ?? []) as ScheduleSlotRow[];
    const slots = allSlots
      .filter((s) => (vendorSlug ? s.id.startsWith(vendorPrefix(vendorSlug)) : !s.id.includes('__')))
      .map((s) => ({ ...s, id: fromStoredSlotId(s.id, vendorSlug) }));
    const dateRows = (datesRes.data ?? []) as Array<
      ScheduleDateRow & { slot_ids?: unknown; enabled_by_vendor?: unknown }
    >;
    const dates = dateRows
      .map((r) => {
        const dateNorm = scheduleDateKey(r.date) ?? String(r.date ?? '').trim();
        const enabled = readVendorEnabled(r.enabled_by_vendor, vendorSlug, Boolean(r.enabled));
        const slot_ids = readVendorSlotIds(r.slot_ids, vendorSlug);
        return {
          ...r,
          date: dateNorm,
          enabled,
          slot_ids,
        };
      })
      .filter((row, i) =>
        vendorScheduleRowVisibleForVendor(
          dateRows[i]?.slot_ids,
          dateRows[i]?.enabled_by_vendor,
          vendorSlug,
          row.slot_ids,
          row.enabled,
        ),
      );
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
  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured (SUPABASE_SERVICE_ROLE_KEY required for admin schedule)' },
      { status: 503 },
    );
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
    const url = new URL(request.url);
    const requestedVendor = (url.searchParams.get('vendor')?.toLowerCase().trim() ?? '') || null;
    if (session.role === 'super_admin' && !requestedVendor) {
      return NextResponse.json({ error: 'vendor query parameter is required for super admin' }, { status: 400 });
    }
    const vendorSessionSlug = (session.vendorId?.toLowerCase().trim() ?? '') || null;
    const vendorSlug = session.role === 'vendor' ? vendorSessionSlug : requestedVendor;
    if (session.role === 'vendor' && !vendorSlug) {
      return NextResponse.json({ error: 'Vendor session is missing vendor id' }, { status: 403 });
    }

    let slotsUpserted = 0;
    let slotsDeleted = 0;
    let datesUpserted = 0;
    let datesPruned = 0;
    let datesDeleted = 0;

    const meantSlots = body.slots !== undefined && Array.isArray(body.slots);
    const meantDates = body.dates !== undefined && Array.isArray(body.dates);
    const meantScheduleWrite = meantSlots || meantDates;

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
        slotsUpserted += 1;
      }
      if (vendorSlug) {
        const kept = new Set<string>();
        for (const row of body.slots) {
          const clientId = String(row?.id ?? '').trim();
          const id = toStoredSlotId(clientId, vendorSlug);
          if (id) kept.add(id);
        }
        const p = vendorPrefix(vendorSlug);
        const { data: scopedSlots, error: listSlotErr } = await supabase.from('schedule_slots').select('id').like('id', `${p}%`);
        if (listSlotErr) return NextResponse.json({ error: listSlotErr.message }, { status: 400 });
        for (const row of scopedSlots ?? []) {
          if (kept.has(row.id)) continue;
          const { error: delSlotErr } = await supabase.from('schedule_slots').delete().eq('id', row.id);
          if (delSlotErr) return NextResponse.json({ error: delSlotErr.message }, { status: 400 });
          slotsDeleted += 1;
        }
      }
    }

    if (body.dates != null && Array.isArray(body.dates)) {
      for (const row of body.dates) {
        const dateStr = scheduleDateKey(row?.date);
        if (!dateStr) return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        const slotIds = Array.isArray(row.slot_ids) ? row.slot_ids.filter((s): s is string => typeof s === 'string').slice(0, 20) : [];
        const storedSlotIds = uniqueSlotIds(slotIds.map((id) => toStoredSlotId(id, vendorSlug)));
        const existing = await supabase
          .from('schedule_dates')
          .select('enabled, slot_ids, enabled_by_vendor')
          .eq('date', dateStr)
          .maybeSingle();
        if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 400 });
        const mergedSlotIds = writeVendorSlotIds(existing.data?.slot_ids, vendorSlug, storedSlotIds);
        const mergedVendorEnabled = writeVendorEnabled(existing.data?.enabled_by_vendor, vendorSlug, Boolean(row.enabled));
        const enabledToStore = vendorSlug ? Boolean(existing.data?.enabled ?? true) : Boolean(row.enabled);
        const { error } = await supabase
          .from('schedule_dates')
          .upsert(
            {
              date: dateStr,
              enabled: enabledToStore,
              slot_ids: mergedSlotIds,
              ...(mergedVendorEnabled ? { enabled_by_vendor: mergedVendorEnabled } : {}),
            },
            { onConflict: 'date' }
          );
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        datesUpserted += 1;
      }
      // When `dates` is included (including []), prune this vendor from every DB row not in the payload so removed dates and empty calendars persist.
      if (vendorSlug && meantDates) {
        const sentDates = new Set(
          body.dates.map((row) => scheduleDateKey(row?.date)).filter((d): d is string => !!d),
        );
        const { data: allDateRows, error: listDatesErr } = await supabase
          .from('schedule_dates')
          .select('date, slot_ids, enabled_by_vendor');
        if (listDatesErr) return NextResponse.json({ error: listDatesErr.message }, { status: 400 });
        for (const row of allDateRows ?? []) {
          const dateKey = scheduleDateKey(row.date);
          if (!dateKey || sentDates.has(dateKey)) continue;
          const raw = row.slot_ids as unknown;
          const enRaw = row.enabled_by_vendor as unknown;
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
          const slotMap = { ...(raw as Record<string, unknown>) };
          const enMap: Record<string, boolean> =
            enRaw && typeof enRaw === 'object' && !Array.isArray(enRaw)
              ? { ...(enRaw as Record<string, boolean>) }
              : {};
          const hadSlots = Object.prototype.hasOwnProperty.call(slotMap, vendorSlug);
          const hadEnabled = Object.prototype.hasOwnProperty.call(enMap, vendorSlug);
          if (!hadSlots && !hadEnabled) continue;
          const nextSlot: Record<string, unknown> = { ...slotMap };
          delete nextSlot[vendorSlug];
          const nextSlotClean = compactSlotIdsMap(nextSlot);
          const nextEn = { ...enMap };
          delete nextEn[vendorSlug];
          if (scheduleDateJsonMapsBare(nextSlotClean, nextEn)) {
            const { error: delErr } = await supabase.from('schedule_dates').delete().eq('date', dateKey);
            if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
            datesDeleted += 1;
          } else {
            const { error: pruneErr } = await supabase
              .from('schedule_dates')
              .update({ slot_ids: nextSlotClean, enabled_by_vendor: nextEn })
              .eq('date', dateKey);
            if (pruneErr) return NextResponse.json({ error: pruneErr.message }, { status: 400 });
            datesPruned += 1;
          }
        }
      }
    }

    const totalMutations = slotsUpserted + slotsDeleted + datesUpserted + datesPruned + datesDeleted;
    console.info(
      '[POST /api/admin/schedule]',
      JSON.stringify({
        role: session.role,
        vendorSlug,
        meantSlots,
        meantDates,
        slotsUpserted,
        slotsDeleted,
        datesUpserted,
        datesPruned,
        datesDeleted,
      }),
    );

    if (meantScheduleWrite && totalMutations === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No schedule changes were persisted. Ensure each time slot has a non-empty ID, then save again.',
          meta: { slotsUpserted, slotsDeleted, datesUpserted, datesPruned, datesDeleted },
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      meta: { slotsUpserted, slotsDeleted, datesUpserted, datesPruned, datesDeleted },
    });
  } catch (e) {
    console.error('POST /api/admin/schedule', e);
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
  }
}
