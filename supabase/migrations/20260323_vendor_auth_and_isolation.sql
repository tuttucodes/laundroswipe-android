-- ============================================================================
-- LaundroSwipe: Vendor auth + join-code + vendor data isolation foundations
-- Run this once in Supabase SQL Editor (after master.sql and vendor_bills.sql).
-- ============================================================================

create extension if not exists pgcrypto;

-- 1) Vendors master table
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Login accounts for /admin (super_admin and vendor roles)
create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('super_admin', 'vendor')),
  vendor_id uuid references public.vendors(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_accounts_vendor_id on public.admin_accounts(vendor_id);

-- 3) Join-code table (mandatory vendor onboarding codes)
create table if not exists public.vendor_join_codes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  code_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_vendor_join_codes_one_active
  on public.vendor_join_codes(vendor_id, active)
  where active = true;

-- 4) Add vendor markers to business tables
alter table public.orders
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

alter table public.vendor_bills
  add column if not exists vendor_name text,
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

create index if not exists idx_orders_vendor_id on public.orders(vendor_id);
create index if not exists idx_vendor_bills_vendor_id on public.vendor_bills(vendor_id);
create index if not exists idx_vendor_bills_vendor_name on public.vendor_bills(vendor_name);
create index if not exists idx_users_college_hostel on public.users(college_id, hostel_block);

-- 5) Seed active vendors
insert into public.vendors (slug, name)
values
  ('profab', 'Pro Fab Power Laundry Services'),
  ('starwash', 'Star Wash Power Launderers')
on conflict (slug) do update set name = excluded.name;

-- 6) Backfill vendor references on orders and bills
update public.orders o
set vendor_id = v.id
from public.vendors v
where o.vendor_id is null
  and (
    lower(coalesce(o.vendor_name, '')) like '%' || lower(v.name) || '%'
    or (v.slug = 'profab' and (o.vendor_name is null or trim(o.vendor_name) = ''))
  );

update public.vendor_bills vb
set vendor_name = coalesce(vb.vendor_name, o.vendor_name, 'Pro Fab Power Laundry Services')
from public.orders o
where vb.order_id = o.id
  and (vb.vendor_name is null or vb.vendor_name = '');

update public.vendor_bills
set vendor_name = 'Pro Fab Power Laundry Services'
where vendor_name is null or vendor_name = '';

update public.vendor_bills vb
set vendor_id = v.id
from public.vendors v
where vb.vendor_id is null
  and lower(coalesce(vb.vendor_name, '')) like '%' || lower(v.name) || '%';

update public.vendor_bills vb
set vendor_id = v.id
from public.vendors v
where vb.vendor_id is null
  and v.slug = 'profab';

-- 7) Password helpers
create or replace function public.admin_hash_password(p_password text)
returns text
language sql
security definer
set search_path = public
as $$
  select extensions.crypt(p_password, extensions.gen_salt('bf', 10));
$$;

create or replace function public.admin_password_matches(p_password text, p_hash text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select extensions.crypt(p_password, p_hash) = p_hash;
$$;

-- 8) Login RPC used by /api/admin/login
create or replace function public.admin_login(p_email text, p_password text)
returns table (
  ok boolean,
  role text,
  vendor_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  select aa.id, aa.role, aa.password_hash, aa.active, v.slug as vendor_slug
  into a
  from public.admin_accounts aa
  left join public.vendors v on v.id = aa.vendor_id
  where lower(aa.email) = lower(trim(p_email))
  limit 1;

  if a.id is null or a.active is distinct from true then
    return query select false, null::text, null::text;
    return;
  end if;

  if not public.admin_password_matches(p_password, a.password_hash) then
    return query select false, null::text, null::text;
    return;
  end if;

  return query select true, a.role::text, a.vendor_slug::text;
end;
$$;

grant execute on function public.admin_login(text, text) to anon, authenticated, service_role;

-- 9) Join-code based vendor account creation (for long-term onboarding)
create or replace function public.register_vendor_admin(
  p_email text,
  p_password text,
  p_vendor_slug text,
  p_join_code text
)
returns table (ok boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  code_row record;
begin
  select * into v
  from public.vendors
  where slug = p_vendor_slug and active = true
  limit 1;

  if v.id is null then
    return query select false, 'Invalid vendor';
    return;
  end if;

  select * into code_row
  from public.vendor_join_codes
  where vendor_id = v.id and active = true
  limit 1;

  if code_row.id is null then
    return query select false, 'Join code not configured';
    return;
  end if;

  if extensions.crypt(p_join_code, code_row.code_hash) <> code_row.code_hash then
    return query select false, 'Invalid join code';
    return;
  end if;

  if exists (select 1 from public.admin_accounts where lower(email) = lower(trim(p_email))) then
    return query select false, 'Account already exists';
    return;
  end if;

  insert into public.admin_accounts (email, password_hash, role, vendor_id, active)
  values (lower(trim(p_email)), public.admin_hash_password(p_password), 'vendor', v.id, true);

  return query select true, 'Vendor account created';
end;
$$;

grant execute on function public.register_vendor_admin(text, text, text, text) to anon, authenticated, service_role;

-- 10) Updated-at trigger for admin_accounts
create or replace function public.set_admin_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_accounts_updated_at on public.admin_accounts;
create trigger admin_accounts_updated_at
before update on public.admin_accounts
for each row execute procedure public.set_admin_accounts_updated_at();

-- 11) RLS (read/write only via service role + security-definer functions)
alter table public.vendors enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.vendor_join_codes enable row level security;

drop policy if exists vendors_select_public on public.vendors;
create policy vendors_select_public on public.vendors
for select to public using (true);

drop policy if exists admin_accounts_service_all on public.admin_accounts;
create policy admin_accounts_service_all on public.admin_accounts
for all to service_role using (true) with check (true);

drop policy if exists vendor_join_codes_service_all on public.vendor_join_codes;
create policy vendor_join_codes_service_all on public.vendor_join_codes
for all to service_role using (true) with check (true);

-- 12) Bootstrap (no secrets in migrations)
-- Create super admin, join codes, and vendor accounts in Supabase SQL Editor using
-- supabase/scripts/bootstrap_admin.example.sql (copy and replace placeholders).

