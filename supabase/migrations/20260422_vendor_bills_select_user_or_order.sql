-- Allow authenticated customers to read vendor_bills linked by user_id OR by their order
-- (covers legacy rows with user_id null but order_id / order_token present).

DROP POLICY IF EXISTS vendor_bills_select_own ON public.vendor_bills;

CREATE POLICY vendor_bills_select_own ON public.vendor_bills
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR (
      order_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = vendor_bills.order_id
          AND o.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND lower(regexp_replace(btrim(coalesce(o.token, '')), '^#+', '', 'g'))
          = lower(regexp_replace(btrim(coalesce(vendor_bills.order_token, '')), '^#+', '', 'g'))
    )
  );
