alter table public.users
  add column if not exists terms_accepted_at timestamptz null,
  add column if not exists terms_version text null;
