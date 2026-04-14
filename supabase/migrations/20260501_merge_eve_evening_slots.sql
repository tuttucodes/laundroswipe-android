-- Canonicalize eve -> evening in schedule_dates.slot_ids, orders.time_slot, and remove duplicate slot rows.
-- Run the entire file in one execution (SQL Editor: paste all, run once). Splitting on semicolons will break PL/pgSQL.

create or replace function public.normalize_schedule_slot_id(input text)
returns text
language sql
immutable
as $id$
  select case
    when input is null then null::text
    when btrim(input) = 'eve' then 'evening'
    when btrim(input) ~ '__eve$' then regexp_replace(btrim(input), '__eve$', '__evening')
    else btrim(input)
  end
$id$;

create or replace function public.normalize_schedule_slot_ids(input jsonb)
returns jsonb
language plpgsql
immutable
as $fn$
declare
  r record;
  k text;
  v jsonb;
  out_obj jsonb := '{}'::jsonb;
begin
  if input is null then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(input) = 'array' then
    return coalesce((
      select jsonb_agg(to_jsonb(s.id) order by s.id)
      from (
        select distinct public.normalize_schedule_slot_id(elem.value) as id
        from jsonb_array_elements_text(input) as elem(value)
        where public.normalize_schedule_slot_id(elem.value) is not null
          and public.normalize_schedule_slot_id(elem.value) <> ''
      ) s
    ), '[]'::jsonb);
  end if;

  if jsonb_typeof(input) = 'object' then
    for r in
      select * from jsonb_each(input)
    loop
      k := r.key;
      v := r.value;
      if jsonb_typeof(v) = 'array' then
        out_obj := out_obj || jsonb_build_object(
          k,
          coalesce((
            select jsonb_agg(to_jsonb(s.id) order by s.id)
            from (
              select distinct public.normalize_schedule_slot_id(elem.value) as id
              from jsonb_array_elements_text(v) as elem(value)
              where public.normalize_schedule_slot_id(elem.value) is not null
                and public.normalize_schedule_slot_id(elem.value) <> ''
            ) s
          ), '[]'::jsonb)
        );
      else
        out_obj := out_obj || jsonb_build_object(k, v);
      end if;
    end loop;
    return out_obj;
  end if;

  return input;
end;
$fn$;

update public.schedule_dates
set slot_ids = public.normalize_schedule_slot_ids(slot_ids)
where slot_ids is not null
  and slot_ids is distinct from public.normalize_schedule_slot_ids(slot_ids);

update public.orders
set time_slot = 'evening'
where lower(btrim(time_slot)) = 'eve';

delete from public.schedule_slots
where id = 'eve' or id like '%__eve';

drop function if exists public.normalize_schedule_slot_ids(jsonb);
drop function if exists public.normalize_schedule_slot_id(text);
