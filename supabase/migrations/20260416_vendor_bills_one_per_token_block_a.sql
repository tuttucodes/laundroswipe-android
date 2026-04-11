-- Single active vendor_bill per normalized order_token (save route updates in place).
-- Removes extra active rows for the same token; reporting uses one row per token.
-- Block rollup: A (e.g. A-102, A / 5) like D1/D2; AB stays literal.

-- 1) Drop token+total unique (replaced by token-only).
DROP INDEX IF EXISTS idx_vendor_bills_active_token_norm_total;

-- 2) Soft-cancel older duplicate active rows per normalized token (keep newest by created_at, id).
-- Rows stay in the table for audit; partial unique index only counts cancelled_at IS NULL.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(regexp_replace(order_token, '^#+', '', 'g')))
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM vendor_bills
  WHERE cancelled_at IS NULL
)
UPDATE vendor_bills vb
SET
  cancelled_at = NOW(),
  cancelled_by_role = 'system_dedup_token_norm'
FROM ranked r
WHERE vb.id = r.id
  AND r.rn > 1;

-- 3) Enforce at most one non-cancelled bill per normalized token.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_bills_active_order_token_norm
ON vendor_bills (
  (lower(trim(regexp_replace(order_token, '^#+', '', 'g'))))
)
WHERE cancelled_at IS NULL;

COMMENT ON INDEX idx_vendor_bills_active_order_token_norm IS
  'At most one active bill per normalized order token; saves update this row.';

-- 4) Revenue RPCs: one row per normalized token (latest created_at).
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
  WITH ranked AS (
    SELECT
      b.created_at,
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
    SELECT created_at, subtotal, convenience_fee, total FROM ranked WHERE rn = 1
  )
  SELECT
    (DATE '1970-01-01' + (FLOOR(EXTRACT(EPOCH FROM d.created_at) / 86400 / p_group_days) * p_group_days)::INT) AS date_from,
    (DATE '1970-01-01' + (FLOOR(EXTRACT(EPOCH FROM d.created_at) / 86400 / p_group_days) * p_group_days + p_group_days - 1)::INT) AS date_to,
    COUNT(*)::BIGINT AS bill_count,
    COALESCE(SUM(d.subtotal), 0) AS subtotal_sum,
    COALESCE(SUM(d.convenience_fee), 0) AS convenience_fee_sum,
    COALESCE(SUM(d.total), 0) AS total_sum
  FROM one_per_token d
  GROUP BY 1, 2
  ORDER BY 1;
$$;

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
  WITH ranked AS (
    SELECT
      b.created_at,
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
    SELECT created_at, line_items, subtotal, convenience_fee, total FROM ranked WHERE rn = 1
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
    FROM one_per_token d
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
  WITH ranked AS (
    SELECT
      b.id,
      b.order_id,
      b.order_token,
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
    SELECT id, order_id, order_token, line_items, subtotal, convenience_fee, total
    FROM ranked
    WHERE rn = 1
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
