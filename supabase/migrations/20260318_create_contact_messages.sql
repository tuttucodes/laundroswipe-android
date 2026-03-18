create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  role text,
  institution text,
  source text not null default 'web_homepage'
);

alter table public.contact_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_messages'
      and policyname = 'contact_messages_insert_public'
  ) then
    create policy contact_messages_insert_public
      on public.contact_messages
      for insert
      to anon, authenticated
      with check (true);
  end if;
end
$$;

