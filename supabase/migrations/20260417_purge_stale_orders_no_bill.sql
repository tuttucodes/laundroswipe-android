-- Remove stale orders: pickup never happened (pre-pickup status), no active bill, created > N days ago.
-- order_status_history CASCADEs; vendor_bills.order_id SET NULL (no bills expected here).

CREATE OR REPLACE FUNCTION purge_orders_no_bill_after_days(p_days INT DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
  days_clamped INT;
BEGIN
  days_clamped := GREATEST(1, LEAST(COALESCE(p_days, 7), 365));

  DELETE FROM orders o
  WHERE o.created_at < NOW() - (days_clamped || ' days')::INTERVAL
    AND o.status IN ('scheduled', 'agent_assigned')
    AND NOT EXISTS (
      SELECT 1
      FROM vendor_bills vb
      WHERE vb.cancelled_at IS NULL
        AND (
          vb.order_id = o.id
          OR lower(trim(regexp_replace(COALESCE(vb.order_token, ''), '^#+', '', 'g')))
           = lower(trim(regexp_replace(COALESCE(o.token, ''), '^#+', '', 'g')))
        )
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION purge_orders_no_bill_after_days(INT) IS
  'Deletes orders in scheduled/agent_assigned with no active vendor_bill (by order_id or token), created_at older than p_days (default 7, clamped 1–365).';

REVOKE ALL ON FUNCTION purge_orders_no_bill_after_days(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_orders_no_bill_after_days(INT) TO service_role;
