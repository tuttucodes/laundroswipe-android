-- Customer read on vendor_bills: user_id + token match to own orders only (drop order_id branch).

DROP POLICY IF EXISTS vendor_bills_select_own ON public.vendor_bills;

CREATE POLICY vendor_bills_select_own ON public.vendor_bills
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR id = auth.uid())
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
