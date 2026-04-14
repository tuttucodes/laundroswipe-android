-- One-time cleanup: old migrations_schedule.sql used generate_series for two March dates
-- (year-relative: Mar 15 and Mar 18). If those rows still exist, they keep showing in admin
-- after you remove your vendor — prune could not remove rows that only had `global` in slot_ids.
-- Review then run in Supabase SQL editor.
--
-- Optional: also run cleanup_stale_schedule_global_slot_ids.sql if rows mix global + vendors.

delete from public.schedule_dates
where date in (
  (date_trunc('year', current_date) + interval '2 months 14 days')::date,
  (date_trunc('year', current_date) + interval '2 months 17 days')::date
);
