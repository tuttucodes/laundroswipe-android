alter table public.schedule_dates
  add column if not exists enabled_by_vendor jsonb not null default '{}'::jsonb;

