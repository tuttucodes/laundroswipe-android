import { uniqueSlotIds } from '@/lib/schedule-slot-merge';
import type { NormalizedScheduleDateRow } from '@/lib/schedule-normalize';
import { scheduleDateRowByKey } from '@/lib/schedule-normalize';

export type ScheduleSlotLike = {
  id: string;
  active: boolean;
};

function normalizeScheduleIdForVendor(id: string, vendorId: string): string | null {
  const raw = String(id ?? '').trim();
  if (!raw) return null;
  const marker = raw.indexOf('__');
  if (marker < 0) return raw;
  const scopedVendor = raw.slice(0, marker);
  const localId = raw.slice(marker + 2);
  if (!scopedVendor || !localId) return null;
  if (!vendorId) return null;
  return scopedVendor === vendorId ? localId : null;
}

function slotIdsForDateByVendor(row: NormalizedScheduleDateRow | undefined, vendorId: string): string[] {
  if (!row) return [];
  const map = row.slot_ids_by_vendor;
  if (map && Object.keys(map).length > 0) {
    if (Object.prototype.hasOwnProperty.call(map, vendorId)) {
      return uniqueSlotIds(map[vendorId] ?? []);
    }
    const globalIds = map['global'];
    if (globalIds?.length) return uniqueSlotIds(globalIds);
    return [];
  }
  const normalized = (row.slot_ids ?? [])
    .map((sid) => normalizeScheduleIdForVendor(sid, vendorId))
    .filter((sid): sid is string => !!sid);
  return uniqueSlotIds(normalized);
}

function isDateEnabledForVendor(row: NormalizedScheduleDateRow | undefined, vendorId: string): boolean {
  if (!row) return false;
  if (!vendorId) return Boolean(row.enabled);
  const vendorEnabledMap = row.enabled_by_vendor;
  if (vendorEnabledMap && typeof vendorEnabledMap === 'object') {
    if (typeof vendorEnabledMap[vendorId] === 'boolean') {
      return Boolean(vendorEnabledMap[vendorId]);
    }
    if (Object.keys(vendorEnabledMap).length > 0) return false;
  }
  return Boolean(row.enabled);
}

export type BookingGuardFailure = { ok: false; error: string; code: string };

/**
 * Ensures pickup date + slot id match admin-configured `schedule_dates` / `schedule_slots` for the vendor.
 */
export function assertBookingMatchesSchedule(params: {
  dates: NormalizedScheduleDateRow[];
  slots: ScheduleSlotLike[];
  vendorSlug: string;
  pickupDate: string;
  timeSlotId: string;
}): { ok: true } | BookingGuardFailure {
  const { dates, slots, vendorSlug, pickupDate, timeSlotId } = params;
  const vid = vendorSlug.trim().toLowerCase();
  const slotId = String(timeSlotId ?? '').trim();
  const dateKey = pickupDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { ok: false, error: 'Invalid pickup date.', code: 'INVALID_PICKUP_DATE' };
  }
  if (!vid || !slotId) {
    return { ok: false, error: 'Missing vendor or time slot.', code: 'INVALID_SLOT' };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (dateKey < todayStr) {
    return { ok: false, error: 'Pickup date is in the past.', code: 'PICKUP_DATE_PAST' };
  }

  const row = scheduleDateRowByKey(dates, dateKey);
  if (!row) {
    return { ok: false, error: 'This date is not available for booking.', code: 'DATE_NOT_BOOKABLE' };
  }
  if (!isDateEnabledForVendor(row, vid)) {
    return { ok: false, error: 'This date is not available for this laundry partner.', code: 'DATE_DISABLED' };
  }

  const allowed = slotIdsForDateByVendor(row, vid);
  if (!allowed.includes(slotId)) {
    return { ok: false, error: 'This time slot is not available on the selected date.', code: 'SLOT_NOT_ALLOWED' };
  }

  const slotOk = slots.some((s) => {
    if (!s.active) return false;
    const local = s.id.includes('__') ? normalizeScheduleIdForVendor(s.id, vid) : s.id;
    return local === slotId;
  });

  if (!slotOk) {
    return { ok: false, error: 'This time slot is not active.', code: 'SLOT_INACTIVE' };
  }

  return { ok: true };
}
