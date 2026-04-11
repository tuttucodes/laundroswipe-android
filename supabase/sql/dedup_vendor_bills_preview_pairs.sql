-- Preview: duplicate rows to soft-cancel for the listed token + total pairs (newest row kept per pair).
-- Run in Supabase SQL editor; then run dedup_vendor_bills_apply_pairs.sql if the list looks right.

WITH pairs(token_norm, total) AS (
  VALUES
    ('zwzj', 274), ('fmkt', 435), ('kg6q', 258), ('akyc', 665), ('b7gd', 160),
    ('bu43', 454), ('hrnv', 356), ('n5r6', 110), ('p77d', 130), ('qphx', 395),
    ('uh5e', 155), ('unhg', 280), ('vzqq', 160), ('xfak', 545), ('z3fb', 475)
),
ranked AS (
  SELECT
    vb.id,
    vb.order_token,
    vb.total,
    vb.created_at,
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
SELECT id, order_token, total, created_at, rn
FROM ranked
WHERE rn > 1
ORDER BY order_token, created_at;
