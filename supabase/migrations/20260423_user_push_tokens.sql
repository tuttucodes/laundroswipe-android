-- Mobile app push token registry.
-- Apply once via the Supabase dashboard SQL editor or `supabase db push`.

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios','android','web','windows','macos')),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_push_tokens_user_id on public.user_push_tokens(user_id);

alter table public.user_push_tokens enable row level security;

-- A user may register / refresh their own device token (matches users.id to auth.uid()).
drop policy if exists user_push_tokens_upsert_own on public.user_push_tokens;
create policy user_push_tokens_upsert_own on public.user_push_tokens
  for insert
  with check (
    user_id in (
      select id from public.users where id = auth.uid() or auth_id = auth.uid()
    )
  );

drop policy if exists user_push_tokens_update_own on public.user_push_tokens;
create policy user_push_tokens_update_own on public.user_push_tokens
  for update
  using (
    user_id in (
      select id from public.users where id = auth.uid() or auth_id = auth.uid()
    )
  );

drop policy if exists user_push_tokens_select_own on public.user_push_tokens;
create policy user_push_tokens_select_own on public.user_push_tokens
  for select
  using (
    user_id in (
      select id from public.users where id = auth.uid() or auth_id = auth.uid()
    )
  );
