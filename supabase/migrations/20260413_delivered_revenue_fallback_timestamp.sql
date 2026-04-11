-- Revenue by delivery date: use delivery_confirmed_at when set, else updated_at
-- (orders advanced to "delivered" via admin advance had status only — no confirm timestamp).

CREATE OR REPLACE FUNCTION get_delivered_revenue_by_date(
  p_vendor_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_tz TEXT DEFAULT 'Asia/Kolkata'
)
RETURNS TABLE (
  delivery_date DATE,
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
      b.id,
      b.order_id,
      b.order_token,
      b.line_items,
      b.subtotal,
      b.convenience_fee,
      b.total
    FROM vendor_bills b
    WHERE b.cancelled_at IS NULL
      AND (p_vendor_id IS NULL OR b.vendor_id = p_vendor_id)
    ORDER BY b.order_token, b.total, b.created_at DESC
  ),
  joined AS (
    SELECT
      d.line_items,
      d.subtotal,
      d.convenience_fee,
      d.total,
      COALESCE(o.delivery_confirmed_at, o.updated_at) AS delivery_effective_at,
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
    INNER JOIN orders o ON (
      (d.order_id IS NOT NULL AND o.id = d.order_id)
      OR (
        d.order_id IS NULL
        AND lower(regexp_replace(trim(d.order_token), '^#+', ''))
          = lower(regexp_replace(trim(o.token), '^#+', ''))
      )
    )
    WHERE o.status = 'delivered'
      AND (p_from IS NULL OR COALESCE(o.delivery_confirmed_at, o.updated_at) >= p_from)
      AND (p_to IS NULL OR COALESCE(o.delivery_confirmed_at, o.updated_at) <= p_to)
  )
  SELECT
    (j.delivery_effective_at AT TIME ZONE p_tz)::date AS delivery_date,
    COUNT(*)::bigint AS bill_count,
    COALESCE(SUM(j.line_qty), 0) AS item_qty_sum,
    COALESCE(SUM(j.subtotal), 0) AS subtotal_sum,
    COALESCE(SUM(j.convenience_fee), 0) AS convenience_fee_sum,
    COALESCE(SUM(j.total), 0) AS total_sum
  FROM joined j
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION get_delivered_revenue_by_block_and_date(
  p_vendor_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_tz TEXT DEFAULT 'Asia/Kolkata'
)
RETURNS TABLE (
  delivery_date DATE,
  block_key TEXT,
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
      b.id,
      b.order_id,
      b.order_token,
      b.customer_hostel_block,
      b.line_items,
      b.subtotal,
      b.convenience_fee,
      b.total
    FROM vendor_bills b
    WHERE b.cancelled_at IS NULL
      AND (p_vendor_id IS NULL OR b.vendor_id = p_vendor_id)
    ORDER BY b.order_token, b.total, b.created_at DESC
  ),
  joined AS (
    SELECT
      d.customer_hostel_block,
      d.line_items,
      d.subtotal,
      d.convenience_fee,
      d.total,
      COALESCE(o.delivery_confirmed_at, o.updated_at) AS delivery_effective_at,
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
    INNER JOIN orders o ON (
      (d.order_id IS NOT NULL AND o.id = d.order_id)
      OR (
        d.order_id IS NULL
        AND lower(regexp_replace(trim(d.order_token), '^#+', ''))
          = lower(regexp_replace(trim(o.token), '^#+', ''))
      )
    )
    WHERE o.status = 'delivered'
      AND (p_from IS NULL OR COALESCE(o.delivery_confirmed_at, o.updated_at) >= p_from)
      AND (p_to IS NULL OR COALESCE(o.delivery_confirmed_at, o.updated_at) <= p_to)
  )
  SELECT
    (j.delivery_effective_at AT TIME ZONE p_tz)::date AS delivery_date,
    CASE
      WHEN NULLIF(trim(j.customer_hostel_block), '') IS NULL THEN 'No block'
      WHEN upper(trim(j.customer_hostel_block)) ~ '^D1([^0-9]|$)' THEN 'D1'
      WHEN upper(trim(j.customer_hostel_block)) ~ '^D2([^0-9]|$)' THEN 'D2'
      ELSE upper(trim(j.customer_hostel_block))
    END AS block_key,
    COUNT(*)::bigint AS bill_count,
    COALESCE(SUM(j.line_qty), 0) AS item_qty_sum,
    COALESCE(SUM(j.subtotal), 0) AS subtotal_sum,
    COALESCE(SUM(j.convenience_fee), 0) AS convenience_fee_sum,
    COALESCE(SUM(j.total), 0) AS total_sum
  FROM joined j
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2;
$$;
