-- Apply: soft-cancel duplicate rows for the same pairs (keeps newest per normalized token + total).
-- Run only after dedup_vendor_bills_preview_pairs.sql looks correct.

WITH pairs(token_norm, total) AS (
  VALUES
    ('zwzj', 274), ('fmkt', 435), ('kg6q', 258), ('akyc', 665), ('b7gd', 160),
    ('bu43', 454), ('hrnv', 356), ('n5r6', 110), ('p77d', 130), ('qphx', 395),
    ('uh5e', 155), ('unhg', 280), ('vzqq', 160), ('xfak', 545), ('z3fb', 475)
),
ranked AS (
  SELECT vb.id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(regexp_replace(vb.order_token, '^#+', '', 'g'))), vb.total
      ORDER BY vb.created_at DESC NULLS LAST, vb.id DESC
    ) AS rn
  FROM vendor_bills vb
  INNER JOIN pairs p
    ON lower(trim(regexp_replace(vb.order_token, '^#+', '', 'g'))) = p.token_norm
   AND vb.total = p.total
  WHERE vb.cancelled_at IS NULL
)
UPDATE vendor_bills vb
SET
  cancelled_at = NOW(),
  cancelled_by_role = 'system_dedup_manual_pairs'
FROM ranked r
WHERE vb.id = r.id
  AND r.rn > 1;
