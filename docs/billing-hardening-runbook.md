# Billing Hardening Runbook (Browser-First)

This runbook is for the current web admin/vendor flow only.

## 1) Supabase safety guardrails

- Keep bill list API at `limit <= 50` (default `20`).
- Use browser cache-first reads on slow networks.
- Enable conservation mode when usage spikes:
  - `BILLING_CONSERVATION_MODE=true`
  - This trims non-critical payload pressure and favors cached reads.

## 2) Archive job (14-day cadence)

Run every 14 days:

```sql
select public.archive_vendor_bills(90, 5000);
```

- `90` = retention days in hot table.
- `5000` = rows per run (reduce if lock pressure appears).
- Repeat until result is `0`.

## 3) Cleanup job

Run daily or every 2-3 days:

```sql
select public.cleanup_billing_operational_tables(7);
```

This removes old idempotency keys and keeps operational tables small.

## 4) Optional maintenance window

For heavy-write periods, schedule:

```sql
vacuum (analyze) public.vendor_bills;
vacuum (analyze) public.vendor_bills_archive;
vacuum (analyze) public.api_idempotency_keys;
```

## 5) Image policy

- Never store base64 data URLs in `vendor_bills.line_items`.
- Only keep short HTTPS URLs (Supabase Storage paths/URLs).
- Compress images before upload and add lifecycle deletion for stale objects.

## 6) Emergency fallback

If egress/storage is close to limit:

1. Set `BILLING_CONSERVATION_MODE=true`
2. Notify operators to avoid large exports during peak hours.
3. Run archive + cleanup jobs.
4. Keep browser billing usable through cached pages and core save/print paths.

## 7) Seamless UX release gate

Do not enable optimization flags globally unless all checks pass:

- Cached bills open without visible lag on low internet.
- New token flow still works with online fallback.
- Save/update/cancel actions do not duplicate or jitter.
- No blocking spinner loops on bills list and detail workflows.

