-- Optional repair after re-running migrations_schedule.sql (old ON CONFLICT DO UPDATE),
-- which overwrote vendor-shaped slot_ids with a flat JSON array.
-- Run once in Supabase SQL Editor if vendors cannot see/save slots after that.
-- Requires app with readVendorSlotIds global fallback (2026-04+) or equivalent.

UPDATE public.schedule_dates
SET slot_ids = jsonb_build_object('global', slot_ids)
WHERE jsonb_typeof(slot_ids) = 'array'
  AND jsonb_typeof(enabled_by_vendor) = 'object'
  AND enabled_by_vendor IS DISTINCT FROM '{}'::jsonb;
