-- Repair legacy vendor_bills linkage to orders/users for customer bill visibility.
-- Idempotent: safe to re-run.

-- Normalize tokens consistently across orders and vendor_bills.
create or replace function public.norm_token(t text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(t, '')), '^#+', '', 'g'));
$$;

-- Performance helpers for token-based repair/lookups.
create index if not exists idx_orders_token_norm
  on public.orders ((public.norm_token(token)));

create index if not exists idx_vendor_bills_token_norm_active
  on public.vendor_bills ((public.norm_token(order_token)))
  where cancelled_at is null;

-- Build a conservative token->owner/order map:
-- only tokens that map to exactly one distinct user_id are auto-repaired.
with token_owner as (
  select
    public.norm_token(o.token) as token_norm,
    min(o.user_id::text)::uuid as owner_user_id,
    count(distinct o.user_id) as owner_count
  from public.orders o
  where nullif(public.norm_token(o.token), '') is not null
    and o.user_id is not null
  group by 1
),
latest_order_for_token as (
  select distinct on (public.norm_token(o.token))
    public.norm_token(o.token) as token_norm,
    o.id as latest_order_id
  from public.orders o
  where nullif(public.norm_token(o.token), '') is not null
  order by public.norm_token(o.token), o.created_at desc nulls last, o.id desc
),
safe_map as (
  select
    t.token_norm,
    t.owner_user_id,
    l.latest_order_id
  from token_owner t
  join latest_order_for_token l on l.token_norm = t.token_norm
  where t.owner_count = 1
)
update public.vendor_bills vb
set
  user_id = coalesce(vb.user_id, sm.owner_user_id),
  order_id = coalesce(vb.order_id, sm.latest_order_id)
from safe_map sm
where public.norm_token(vb.order_token) = sm.token_norm
  and vb.cancelled_at is null
  and (vb.user_id is null or vb.order_id is null);

-- Keep users self-read policy compatible with both id and auth_id mappings.
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select to authenticated
  using (auth.uid() = auth_id or auth.uid() = id);

-- Restore robust customer visibility on vendor_bills:
-- direct bill ownership, order_id linkage, and token fallback.
drop policy if exists vendor_bills_select_own on public.vendor_bills;

create policy vendor_bills_select_own on public.vendor_bills
  for select to authenticated
  using (
    user_id = auth.uid()
    or user_id in (
      select u.id
      from public.users u
      where u.auth_id = auth.uid() or u.id = auth.uid()
    )
    or (
      order_id is not null
      and exists (
        select 1
        from public.orders o
        where o.id = vendor_bills.order_id
          and (
            o.user_id = auth.uid()
            or o.user_id in (
              select u.id
              from public.users u
              where u.auth_id = auth.uid() or u.id = auth.uid()
            )
          )
      )
    )
    or exists (
      select 1
      from public.orders o
      where (
          o.user_id = auth.uid()
          or o.user_id in (
            select u.id
            from public.users u
            where u.auth_id = auth.uid() or u.id = auth.uid()
          )
        )
        and public.norm_token(o.token) = public.norm_token(vendor_bills.order_token)
    )
  );
