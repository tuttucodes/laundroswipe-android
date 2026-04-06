-- Mark exact duplicate bills as cancelled.
-- Only deduplicates when both order_token AND total match (same token, same amount).
-- Bills with same token but different amounts are intentional and kept.
WITH ranked AS (
  SELECT id,
         order_token,
         total,
         ROW_NUMBER() OVER (PARTITION BY order_token, total ORDER BY created_at DESC) AS rn
  FROM vendor_bills
  WHERE cancelled_at IS NULL
)
UPDATE vendor_bills
SET cancelled_at = NOW(),
    cancelled_by_role = 'system_dedup'
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
