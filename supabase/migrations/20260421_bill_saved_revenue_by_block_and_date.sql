-- Bill-save date × block: same one-per-token window as get_bill_saved_revenue_by_date;
-- block from bill snapshot, else linked order user's profile; normalize_hostel_block_key → "No block".

CREATE OR REPLACE FUNCTION get_bill_saved_revenue_by_block_and_date(
  p_vendor_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_tz TEXT DEFAULT 'Asia/Kolkata'
)
RETURNS TABLE (
  bill_date DATE,
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
      b.created_at,
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
      AND (p_from IS NULL OR b.created_at >= p_from)
      AND (p_to IS NULL OR b.created_at <= p_to)
  ),
  one_per_token AS (
    SELECT
      id,
      created_at,
      order_id,
      order_token,
      customer_hostel_block,
      line_items,
      subtotal,
      convenience_fee,
      total
    FROM ranked
    WHERE rn = 1
  ),
  joined AS (
    SELECT DISTINCT ON (d.id)
      d.created_at,
      d.customer_hostel_block,
      d.line_items,
      d.subtotal,
      d.convenience_fee,
      d.total,
      u.hostel_block AS user_hostel_block,
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
    LEFT JOIN orders o ON (
      (d.order_id IS NOT NULL AND o.id = d.order_id)
      OR (
        d.order_id IS NULL
        AND lower(regexp_replace(trim(d.order_token), '^#+', ''))
          = lower(regexp_replace(trim(o.token), '^#+', ''))
      )
    )
    LEFT JOIN users u ON u.id = o.user_id
    ORDER BY d.id, o.created_at DESC NULLS LAST, o.id DESC NULLS LAST
  )
  SELECT
    (j.created_at AT TIME ZONE p_tz)::date AS bill_date,
    normalize_hostel_block_key(
      CASE
        WHEN j.customer_hostel_block IS NOT NULL AND btrim(j.customer_hostel_block) <> '' THEN j.customer_hostel_block
        ELSE j.user_hostel_block
      END
    ) AS block_key,
    COUNT(*)::bigint AS bill_count,
    COALESCE(SUM(j.line_qty), 0) AS item_qty_sum,
    COALESCE(SUM(j.subtotal), 0) AS subtotal_sum,
    COALESCE(SUM(j.convenience_fee), 0) AS convenience_fee_sum,
    COALESCE(SUM(j.total), 0) AS total_sum
  FROM joined j
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2;
$$;

COMMENT ON FUNCTION get_bill_saved_revenue_by_block_and_date(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'Bill-saved-day revenue by rollup block; bill customer_hostel_block first, else users.hostel_block; includes No block.';
