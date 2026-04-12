/**
 * TypeScript types for the Next.js app only.
 *
 * Do not paste this file into the Supabase SQL Editor — SQL cannot run `export` or TypeScript.
 * Database changes belong in .sql files under supabase/migrations/ (see repo) and are applied via Supabase CLI or Dashboard SQL only.
 *
 * ---
 * Contract for GET /api/admin/dashboard (vendor session). Shared with `normalizeVendorDashboardPayload`.
 * Optional query params: `omit_blocks=1` skips block rollup RPCs (faster first paint); then call
 * `blocks_only=1` for `collected_by_block` + `billed_by_block` with the same `block_from` / `block_to` as the main request.
 *
 * Vendor dashboard also calls (same session, Bearer admin_token):
 * - GET /api/admin/orders/delivered-day-detail?date=
 * - GET /api/admin/orders/block-day-detail?date=&block_key=
 * - GET /api/admin/orders/bill-day-block-detail?date=&block_key=&block_from=&block_to=
 */

export type VendorDashboardMetrics = {
  revenue_7d: { total: number; bill_count: number; by_date: { date: string; bill_count: number; total: number }[] };
  revenue_30d: { total: number; bill_count: number; by_date: { date: string; bill_count: number; total: number }[] };
  billed_7d: {
    total: number;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    by_date: Array<{
      date: string;
      bill_count: number;
      item_qty_sum: number;
      subtotal: number;
      convenience_fee: number;
      total: number;
    }>;
  };
  billed_30d: {
    total: number;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    by_date: Array<{
      date: string;
      bill_count: number;
      item_qty_sum: number;
      subtotal: number;
      convenience_fee: number;
      total: number;
    }>;
  };
  collected_7d: {
    total: number;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    by_date: Array<{
      date: string;
      bill_count: number;
      item_qty_sum: number;
      subtotal: number;
      convenience_fee: number;
      total: number;
    }>;
  };
  collected_30d: {
    total: number;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    by_date: Array<{
      date: string;
      bill_count: number;
      item_qty_sum: number;
      subtotal: number;
      convenience_fee: number;
      total: number;
    }>;
  };
  collected_by_block: Array<{
    delivery_date: string;
    block_key: string;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    total: number;
  }>;
  billed_by_block: Array<{
    bill_date: string;
    block_key: string;
    bill_count: number;
    item_qty_sum: number;
    subtotal: number;
    convenience_fee: number;
    total: number;
  }>;
  open_tokens: { count: number; by_status: Record<string, number> };
  delivered_7d: { count: number; by_date: { date: string; count: number }[] };
  delivered_30d: { count: number; by_date: { date: string; count: number }[] };
};
