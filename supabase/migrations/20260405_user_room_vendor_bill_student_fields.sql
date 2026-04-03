-- Separate room number from hostel block; copy onto vendor bills for printing.
alter table public.users
  add column if not exists room_number text;

alter table public.vendor_bills
  add column if not exists customer_reg_no text,
  add column if not exists customer_hostel_block text,
  add column if not exists customer_room_number text;

comment on column public.users.room_number is 'Hostel room number (block stays in hostel_block).';
comment on column public.vendor_bills.customer_reg_no is 'Snapshot from users.reg_no when bill is saved.';
comment on column public.vendor_bills.customer_hostel_block is 'Snapshot from users.hostel_block when bill is saved.';
comment on column public.vendor_bills.customer_room_number is 'Snapshot from users.room_number when bill is saved.';
