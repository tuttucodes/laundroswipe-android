-- Fix: Google sign-up complete-profile update was failing because RLS required auth_id
-- but we only set id = auth user id. This migration:
-- 1) Allows UPDATE when auth.uid() = id OR auth.uid() = auth_id
-- 2) Backfills auth_id for existing rows where id matches an auth user (e.g. Google sign-ups)

-- Drop existing update policy
DROP POLICY IF EXISTS "users_update_own" ON users;

-- Allow update when JWT auth.uid() matches either users.id or users.auth_id
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR auth.uid() = auth_id);

-- Backfill auth_id for rows created by Google (id = auth user id) so policy works consistently
UPDATE users
SET auth_id = id
WHERE auth_id IS NULL
  AND id IN (SELECT id FROM auth.users);
