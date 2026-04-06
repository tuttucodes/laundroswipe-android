-- Mark duplicate bills as cancelled so only the latest bill per token is active.
-- For each order_token with multiple active bills, keep the newest and cancel the rest.
WITH ranked AS (
  SELECT id,
         order_token,
         ROW_NUMBER() OVER (PARTITION BY order_token ORDER BY created_at DESC) AS rn
  FROM vendor_bills
  WHERE cancelled_at IS NULL
)
UPDATE vendor_bills
SET cancelled_at = NOW(),
    cancelled_by_role = 'system_dedup'
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
