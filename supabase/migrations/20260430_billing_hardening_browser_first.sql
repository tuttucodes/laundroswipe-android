-- Browser-first billing hardening:
-- - sync metadata columns
-- - idempotency store
-- - archive table + archive procedure
-- - cleanup helpers
-- - optional vendor-claim RLS guardrails

alter table public.vendor_bills
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_by_role text null;

update public.vendor_bills
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create index if not exists idx_vendor_bills_updated_at on public.vendor_bills(updated_at desc);
create index if not exists idx_vendor_bills_cancelled_at on public.vendor_bills(cancelled_at);
create index if not exists idx_vendor_bills_created_at on public.vendor_bills(created_at desc);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vendor_bills_updated_at on public.vendor_bills;
create trigger trg_vendor_bills_updated_at
before update on public.vendor_bills
for each row
execute procedure public.set_updated_at_timestamp();

create table if not exists public.api_idempotency_keys (
  id bigserial primary key,
  idempotency_key text not null unique,
  endpoint text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_idempotency_endpoint_created
  on public.api_idempotency_keys(endpoint, created_at desc);

create table if not exists public.api_usage_daily (
  id bigserial primary key,
  usage_date date not null default current_date,
  endpoint text not null,
  calls integer not null default 0,
  approx_response_bytes bigint not null default 0,
  unique (usage_date, endpoint)
);

create or replace function public.record_api_usage_daily(
  p_endpoint text,
  p_calls integer default 1,
  p_response_bytes bigint default 0
)
returns void
language plpgsql
as $$
begin
  insert into public.api_usage_daily (usage_date, endpoint, calls, approx_response_bytes)
  values (current_date, p_endpoint, greatest(p_calls, 1), greatest(p_response_bytes, 0))
  on conflict (usage_date, endpoint)
  do update set
    calls = public.api_usage_daily.calls + excluded.calls,
    approx_response_bytes = public.api_usage_daily.approx_response_bytes + excluded.approx_response_bytes;
end;
$$;

create table if not exists public.vendor_bills_archive (
  archived_id bigserial primary key,
  archived_at timestamptz not null default now(),
  source_id uuid,
  order_id uuid null,
  order_token text not null,
  order_number text null,
  customer_name text null,
  customer_phone text null,
  customer_reg_no text null,
  customer_hostel_block text null,
  customer_room_number text null,
  user_id uuid null,
  line_items jsonb not null,
  subtotal numeric not null,
  convenience_fee numeric not null default 0,
  total numeric not null,
  vendor_name text null,
  vendor_id uuid null,
  vendor_slug text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  cancelled_at timestamptz null,
  cancelled_by_role text null
);

create index if not exists idx_vendor_bills_archive_vendor_created
  on public.vendor_bills_archive(vendor_id, created_at desc);
create index if not exists idx_vendor_bills_archive_token
  on public.vendor_bills_archive(order_token);

create or replace function public.archive_vendor_bills(
  p_retention_days integer default 90,
  p_batch_limit integer default 5000
)
returns integer
language plpgsql
as $$
declare
  moved_count integer := 0;
begin
  with candidate as (
    select b.id
    from public.vendor_bills b
    where b.created_at < now() - make_interval(days => p_retention_days)
    order by b.created_at asc
    limit greatest(p_batch_limit, 1)
  ),
  copied as (
    insert into public.vendor_bills_archive (
      source_id, order_id, order_token, order_number, customer_name, customer_phone,
      customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items,
      subtotal, convenience_fee, total, vendor_name, vendor_id, vendor_slug,
      created_at, updated_at, cancelled_at, cancelled_by_role
    )
    select
      b.id, b.order_id, b.order_token, b.order_number, b.customer_name, b.customer_phone,
      b.customer_reg_no, b.customer_hostel_block, b.customer_room_number, b.user_id, b.line_items,
      b.subtotal, b.convenience_fee, b.total, b.vendor_name, b.vendor_id, null,
      b.created_at, b.updated_at, b.cancelled_at, b.cancelled_by_role
    from public.vendor_bills b
    inner join candidate c on c.id = b.id
    returning source_id
  )
  delete from public.vendor_bills b
  using copied cp
  where b.id = cp.source_id;

  get diagnostics moved_count = row_count;
  return coalesce(moved_count, 0);
end;
$$;

create or replace function public.cleanup_billing_operational_tables(
  p_idempotency_days integer default 7
)
returns void
language plpgsql
as $$
begin
  delete from public.api_idempotency_keys
  where created_at < now() - make_interval(days => greatest(p_idempotency_days, 1));
end;
$$;

alter table public.api_idempotency_keys enable row level security;
drop policy if exists api_idempotency_service_only on public.api_idempotency_keys;
create policy api_idempotency_service_only on public.api_idempotency_keys
for all to authenticated
using (false)
with check (false);

-- Optional guardrail policy for clients authenticated with vendor_id in JWT claims.
drop policy if exists vendor_bills_select_vendor_claim on public.vendor_bills;
create policy vendor_bills_select_vendor_claim on public.vendor_bills
for select to authenticated
using (
  vendor_id is not null
  and vendor_id::text = coalesce(
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'vendor_id'), ''),
    '__no_vendor__'
  )
);

