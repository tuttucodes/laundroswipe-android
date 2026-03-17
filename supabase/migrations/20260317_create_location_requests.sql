create table if not exists public.location_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  location_text text not null,
  lat double precision,
  lng double precision,
  contact_email text,
  source text not null default 'web_homepage'
);

alter table public.location_requests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'location_requests'
      and policyname = 'location_requests_insert_public'
  ) then
    create policy location_requests_insert_public
      on public.location_requests
      for insert
      to anon, authenticated
      with check (true);
  end if;
end
$$;

