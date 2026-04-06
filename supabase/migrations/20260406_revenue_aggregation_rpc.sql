-- Server-side revenue aggregation function
-- Groups bills by date buckets for efficient revenue reporting
CREATE OR REPLACE FUNCTION get_revenue_by_date(
  p_group_days INT DEFAULT 1,
  p_vendor_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  date_from DATE,
  date_to DATE,
  bill_count BIGINT,
  subtotal_sum NUMERIC,
  convenience_fee_sum NUMERIC,
  total_sum NUMERIC
)
LANGUAGE sql STABLE
AS $$
  SELECT
    -- Bucket start: floor to p_group_days intervals
    (DATE '1970-01-01' + (FLOOR(EXTRACT(EPOCH FROM b.created_at) / 86400 / p_group_days) * p_group_days)::INT) AS date_from,
    (DATE '1970-01-01' + (FLOOR(EXTRACT(EPOCH FROM b.created_at) / 86400 / p_group_days) * p_group_days + p_group_days - 1)::INT) AS date_to,
    COUNT(*)::BIGINT AS bill_count,
    COALESCE(SUM(b.subtotal), 0) AS subtotal_sum,
    COALESCE(SUM(b.convenience_fee), 0) AS convenience_fee_sum,
    COALESCE(SUM(b.total), 0) AS total_sum
  FROM vendor_bills b
  WHERE b.cancelled_at IS NULL
    AND (p_vendor_id IS NULL OR b.vendor_id = p_vendor_id)
    AND (p_from IS NULL OR b.created_at >= p_from)
    AND (p_to IS NULL OR b.created_at <= p_to)
  GROUP BY 1, 2
  ORDER BY 1;
$$;
