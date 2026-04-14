# Billing Hardening Verification Checklist

Use this checklist before enabling any feature flag globally.

## Feature flags / env toggles

- `BILLING_CONSERVATION_MODE=false` (default)
- Enable per-environment gradually after verification.

## Functional checks

1. Bills list pagination
   - Request `GET /api/vendor/bills` without `limit` returns `limit=20`.
   - Request with large `limit` is clamped to `50`.
2. Cached first paint
   - Open bills page once online.
   - Reload with slow network and confirm cached list renders before network completes.
3. Incremental refresh metadata
   - Response includes `synced_at`.
   - Client writes `last_sync` metadata and reuses it on subsequent fetch.
4. Save/update idempotency
   - Repeat same save payload quickly; API must return reused/updated without duplicates.
   - Repeat same update payload quickly; API must return stable success.
5. Cancel flow
   - Cancel marks bill with `cancelled_at` and removes it from active vendor list.
   - Same token can be billed again.

## Supabase usage guardrails

1. Rate limits
   - Rapid repeated calls eventually return `429` for heavy endpoints.
2. Conservation mode
   - Set `BILLING_CONSERVATION_MODE=true`.
   - Verify bills endpoint still works, payload remains minimal, and UX remains smooth.
3. Usage logging
   - Confirm `api_usage_daily` rows are being incremented for billing endpoints.

## Data lifecycle

1. Archive function
   - Run `select public.archive_vendor_bills(90, 100);`
   - Confirm rows move from `vendor_bills` to `vendor_bills_archive`.
2. Cleanup function
   - Run `select public.cleanup_billing_operational_tables(7);`
   - Confirm old idempotency keys are removed.

## Seamless UX gate (must pass)

- No blocking spinner loops.
- No duplicate toast spam on retry flows.
- Slow network still allows normal vendor operation.
- Token lookup remains intuitive:
  - Known/synced flows stay fast.
  - New token online fallback remains clear and non-breaking.

If any item fails, keep flags off and rollback to previous behavior.

