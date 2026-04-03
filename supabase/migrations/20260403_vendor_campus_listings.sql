-- Which laundry vendors are bookable at which campus (matches users.college_id, e.g. vit-chn).
create table if not exists public.vendor_campus (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  campus_id text not null,
  created_at timestamptz not null default now(),
  primary key (vendor_id, campus_id)
);

create index if not exists idx_vendor_campus_campus_id on public.vendor_campus (campus_id);

alter table public.vendor_campus enable row level security;

drop policy if exists vendor_campus_select_public on public.vendor_campus;
create policy vendor_campus_select_public on public.vendor_campus for select to public using (true);

drop policy if exists vendor_campus_service_all on public.vendor_campus;
create policy vendor_campus_service_all on public.vendor_campus for all to service_role using (true) with check (true);

-- Seed VIT Chennai campus (app college_id is vit-chn, not colleges.short_code).
insert into public.vendor_campus (vendor_id, campus_id)
select v.id, 'vit-chn'
from public.vendors v
where v.slug in ('profab', 'starwash')
on conflict (vendor_id, campus_id) do nothing;
