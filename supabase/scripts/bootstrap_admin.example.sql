-- Copy into Supabase SQL Editor. Replace ALL placeholders before running.
-- Run once after migration 20260323 (and 20260331). Never commit real values.

-- 1) Super admin (vendor_id must stay NULL)
insert into public.admin_accounts (email, password_hash, role, active)
values (
  'you@yourdomain.com',
  public.admin_hash_password('YOUR_STRONG_PASSWORD'),
  'super_admin',
  true
)
on conflict (email) do update set
  password_hash = excluded.password_hash,
  role = excluded.role,
  active = excluded.active;

-- 2) Join codes per vendor (plain text here is hashed; store only hashes in DB)
insert into public.vendor_join_codes (vendor_id, code_hash, active)
select v.id, public.admin_hash_password('YOUR_VENDOR_JOIN_PLAINTEXT'), true
from public.vendors v
where v.slug = 'profab'
on conflict do nothing;

-- 3) Optional: create vendor admin without using the app register form
-- select * from public.register_vendor_admin(
--   'vendor@yourdomain.com',
--   'THEIR_PASSWORD',
--   'profab',
--   'YOUR_VENDOR_JOIN_PLAINTEXT'
-- );
