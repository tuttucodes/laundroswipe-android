-- One active bill per (normalized order_token, total). Prevents duplicate saves / double-print.
-- Normalization: strip leading #, trim, lower-case (matches app + reporting dedupe).

-- 1) Soft-cancel older duplicates; keep newest row per (norm_token, total).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(regexp_replace(order_token, '^#+', '', 'g'))), total
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM vendor_bills
  WHERE cancelled_at IS NULL
)
UPDATE vendor_bills vb
SET
  cancelled_at = NOW(),
  cancelled_by_role = 'system_dedup_pre_unique'
FROM ranked r
WHERE vb.id = r.id
  AND r.rn > 1;

-- 2) Enforce at database level (concurrent safe for new inserts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_bills_active_token_norm_total
ON vendor_bills (
  (lower(trim(regexp_replace(order_token, '^#+', '', 'g')))),
  total
)
WHERE cancelled_at IS NULL;

COMMENT ON INDEX idx_vendor_bills_active_token_norm_total IS
  'At most one non-cancelled bill per normalized token + total; prevents duplicate save races.';
