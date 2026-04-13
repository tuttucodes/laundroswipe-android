-- Allow customers whose public.users.id equals auth.uid() (e.g. Google) or auth_id = auth.uid()
-- to read/update their orders and read vendor_bills. Fixes empty "My bills" when auth_id was never set.

-- ---------------------------------------------------------------------------
-- ORDERS: same visibility whether linked by users.auth_id or users.id = JWT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_insert_authenticated ON public.orders;
DROP POLICY IF EXISTS orders_select_own ON public.orders;
DROP POLICY IF EXISTS orders_update_own ON public.orders;

CREATE POLICY orders_insert_authenticated ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY orders_update_own ON public.orders
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- VENDOR BILLS: match owner by user_id and by order / token (subquery uses orders RLS above)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS vendor_bills_select_own ON public.vendor_bills;

CREATE POLICY vendor_bills_select_own ON public.vendor_bills
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid())
    OR (
      order_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = vendor_bills.order_id
          AND (
            o.user_id = auth.uid()
            OR o.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid())
          )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE (
          o.user_id = auth.uid()
          OR o.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid())
        )
        AND lower(regexp_replace(btrim(coalesce(o.token, '')), '^#+', '', 'g'))
          = lower(regexp_replace(btrim(coalesce(vendor_bills.order_token, '')), '^#+', '', 'g'))
    )
  );
