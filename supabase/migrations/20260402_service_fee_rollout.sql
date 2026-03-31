-- Service fee rollout:
-- 1. Keeps historical schema files untouched.
-- 2. Sets new defaults for future records.
-- 3. Recalculates existing saved bills so admin/super admin totals stay correct.
-- 4. Updates vendor-facing pricing copy shown in the app.

-- Future rows should default to 0 and be calculated in app/backend logic.
alter table public.orders
  alter column convenience_fee set default 0.00;

alter table public.vendor_bills
  alter column convenience_fee set default 0.00;

-- Backfill existing saved bills to the new service fee slabs.
with recalculated as (
  select
    id,
    subtotal,
    case
      when coalesce(subtotal, 0) < 50 then 0
      when coalesce(subtotal, 0) < 100 then 5
      when coalesce(subtotal, 0) < 200 then 10
      else 20
    end as new_service_fee
  from public.vendor_bills
)
update public.vendor_bills vb
set
  convenience_fee = recalculated.new_service_fee,
  total = coalesce(recalculated.subtotal, 0) + recalculated.new_service_fee
from recalculated
where vb.id = recalculated.id;

-- Refresh vendor pricing copy to explain the new Service fee.
insert into public.vendor_profiles (slug, name, brief, pricing_details, logo_url)
values (
  'profab',
  'Pro Fab Power Launders',
  'Pro Fab Power Launders is our campus laundry partner. We pick up from your hostel, wash & iron, and deliver back on the same cycle. Service days: Tuesday, Saturday, Sunday.',
  E'Shirt ₹19\nT shirt ₹19\nWhite shirt ₹25\nWhite t shirt ₹25\nPant ₹22\nJean ₹22\nDry clean (shirt/T-shirt) ₹50\nDry clean (white/formal) ₹60\n\nService fee is added separately based on the final bill subtotal.\nService fee helps cover LaundroSwipe''s order support, pickup coordination, tracking, notifications, and billing management. Laundry charges are set separately by the vendor.',
  '/profab-logo.png'
)
on conflict (slug) do update set
  name = excluded.name,
  brief = excluded.brief,
  pricing_details = excluded.pricing_details,
  logo_url = excluded.logo_url,
  updated_at = now();

insert into public.vendor_profiles (slug, name, brief, pricing_details, logo_url)
values (
  'starwash',
  'Star Wash Power Launderers',
  'Star Wash serves VIT Chennai students in B, C, and E blocks with scheduled campus pickup and return.',
  E'Pricing is shared by the vendor at billing time.\n\nService fee is added separately based on the final bill subtotal.\nService fee helps cover LaundroSwipe''s order support, pickup coordination, tracking, notifications, and billing management. Laundry charges are set separately by the vendor.',
  null
)
on conflict (slug) do update set
  name = excluded.name,
  brief = excluded.brief,
  pricing_details = excluded.pricing_details,
  logo_url = excluded.logo_url,
  updated_at = now();
