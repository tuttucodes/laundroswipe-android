-- Let authenticated users read their profile row when id = auth.uid() even if auth_id is null
-- (needed for RLS subqueries and consistent app reads).

DROP POLICY IF EXISTS users_select_own ON public.users;

CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_id OR auth.uid() = id);
