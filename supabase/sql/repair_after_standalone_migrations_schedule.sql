-- -----------------------------------------------------------------------------
-- Repair: ran supabase/migrations_schedule.sql without full master / migrations
-- -----------------------------------------------------------------------------
-- That script creates schedule_dates but omits enabled_by_vendor, which the app
-- expects (see supabase/migrations/20260402_schedule_vendor_enablement.sql).
-- It also assumes set_updated_at() exists for the trigger.
--
-- Run once in Supabase SQL Editor. Safe to re-run.
-- -----------------------------------------------------------------------------

-- App + admin API read/write this column on schedule_dates
alter table public.schedule_dates
  add column if not exists enabled_by_vendor jsonb not null default '{}'::jsonb;

-- Same helper as supabase/master.sql (no-op if already defined)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedule_dates_updated_at on public.schedule_dates;
create trigger schedule_dates_updated_at
  before update on public.schedule_dates
  for each row
  execute procedure public.set_updated_at();

-- RLS: anon/auth can read; writes go through service role API
alter table public.schedule_slots enable row level security;
alter table public.schedule_dates enable row level security;
drop policy if exists "schedule_slots_select" on public.schedule_slots;
drop policy if exists "schedule_dates_select" on public.schedule_dates;
create policy "schedule_slots_select" on public.schedule_slots
  for select to public using (true);
create policy "schedule_dates_select" on public.schedule_dates
  for select to public using (true);
