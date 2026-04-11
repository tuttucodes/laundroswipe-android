-- Align SQL block rollups with lib/hostel-block.ts: "Block A" / "BLOCK-A" → A, D1, D2.

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
  WITH ranked AS (
    SELECT
      b.id,
      b.order_id,
      b.order_token,
      b.customer_hostel_block,
      b.line_items,
      b.subtotal,
      b.convenience_fee,
      b.total,
      ROW_NUMBER() OVER (
        PARTITION BY lower(trim(regexp_replace(b.order_token, '^#+', '', 'g')))
        ORDER BY b.created_at DESC NULLS LAST, b.id DESC
      ) AS rn
    FROM vendor_bills b
    WHERE b.cancelled_at IS NULL
      AND (p_vendor_id IS NULL OR b.vendor_id = p_vendor_id)
  ),
  one_per_token AS (
    SELECT id, order_id, order_token, customer_hostel_block, line_items, subtotal, convenience_fee, total
    FROM ranked
    WHERE rn = 1
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
    FROM one_per_token d
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
      WHEN upper(trim(j.customer_hostel_block)) ~ '^BLOCK\s*[-:]?\s*A([^A-Za-z]|$)' THEN 'A'
      WHEN upper(trim(j.customer_hostel_block)) ~ '^BLOCK\s*[-:]?\s*D1([^0-9]|$)' THEN 'D1'
      WHEN upper(trim(j.customer_hostel_block)) ~ '^BLOCK\s*[-:]?\s*D2([^0-9]|$)' THEN 'D2'
      WHEN upper(trim(j.customer_hostel_block)) ~ '^A([^A-Za-z]|$)' THEN 'A'
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
