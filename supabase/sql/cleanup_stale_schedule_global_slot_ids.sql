-- One-time cleanup: remove empty `global` entries from vendor-shaped slot_ids JSON.
-- Those empty objects prevented full row deletes and made the admin UI fall back to
-- ghost "global" slots after you removed a vendor from a date.
--
-- Safe to run multiple times.

update public.schedule_dates
set slot_ids = slot_ids - 'global'
where jsonb_typeof(slot_ids) = 'object'
  and slot_ids ? 'global'
  and coalesce(jsonb_array_length(slot_ids->'global'), 0) = 0;
