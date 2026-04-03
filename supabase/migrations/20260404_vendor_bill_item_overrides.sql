-- Per-vendor overrides for default bill catalog (label, price, optional image) for faster billing UI.
alter table public.vendor_profiles
  add column if not exists bill_item_overrides jsonb not null default '{}'::jsonb;

comment on column public.vendor_profiles.bill_item_overrides is
  'Map of catalog item id -> { price?, label?, image_url? }; merged with lib/constants defaults when billing.';
