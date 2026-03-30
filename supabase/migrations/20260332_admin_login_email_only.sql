-- Email + password only (no client-side vendor picker). Role and vendor come from admin_accounts.
drop function if exists public.admin_login(text, text, text);

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
