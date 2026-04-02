alter table public.vendor_bills
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_role text;

