-- Daily totals by bill saved time in IST (matches vendor mental model; delivery-day RPC stays separate).

CREATE OR REPLACE FUNCTION get_bill_saved_revenue_by_date(
  p_vendor_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_tz TEXT DEFAULT 'Asia/Kolkata'
)
RETURNS TABLE (
  bill_date DATE,
  bill_count BIGINT,
  item_qty_sum NUMERIC,
  subtotal_sum NUMERIC,
  convenience_fee_sum NUMERIC,
  total_sum NUMERIC
)
LANGUAGE sql STABLE
AS $$
  WITH deduped AS (
    SELECT DISTINCT ON (b.order_token, b.total)
      b.created_at,
      b.line_items,
      b.subtotal,
      b.convenience_fee,
      b.total
    FROM vendor_bills b
    WHERE b.cancelled_at IS NULL
      AND (p_vendor_id IS NULL OR b.vendor_id = p_vendor_id)
      AND (p_from IS NULL OR b.created_at >= p_from)
      AND (p_to IS NULL OR b.created_at <= p_to)
    ORDER BY b.order_token, b.total, b.created_at DESC
  ),
  enriched AS (
    SELECT
      d.created_at,
      d.subtotal,
      d.convenience_fee,
      d.total,
      (
        SELECT COALESCE(SUM(
          COALESCE(
            NULLIF(trim(elem->>'qty'), '')::numeric,
            NULLIF(trim(elem->>'quantity'), '')::numeric,
            0
          )
        ), 0)
        FROM jsonb_array_elements(COALESCE(d.line_items, '[]'::jsonb)) AS elem
      ) AS line_qty
    FROM deduped d
  )
  SELECT
    (e.created_at AT TIME ZONE p_tz)::date AS bill_date,
    COUNT(*)::bigint AS bill_count,
    COALESCE(SUM(e.line_qty), 0) AS item_qty_sum,
    COALESCE(SUM(e.subtotal), 0) AS subtotal_sum,
    COALESCE(SUM(e.convenience_fee), 0) AS convenience_fee_sum,
    COALESCE(SUM(e.total), 0) AS total_sum
  FROM enriched e
  GROUP BY 1
  ORDER BY 1;
$$;
