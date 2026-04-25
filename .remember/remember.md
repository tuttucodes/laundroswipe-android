# Handoff

## State

- Expo SDK 54 RN app at `/Volumes/T7/code/laundroswipe-app`. EAS project `@itsrahulbk/laundroswipe` id `1dacd981-be63-4ce3-a46f-4de81e1ee499`. Bundle `com.laundroswipe.app`.
- First Android preview build shipped (APK): https://expo.dev/accounts/itsrahulbk/projects/laundroswipe/builds/f535ef04-6714-4161-a71b-508573466109. iOS sim boots on `iPhone 17 Pro` via `expo run:ios`. `tsc --noEmit` clean.
- Phases 1–6 wired: auth (Google OAuth via Supabase hosted, admin email+pass), customer home/schedule wizard/orders/detail/handshake QR, profile/bills/notifications/green/edit-profile, vendor POS/lookup/bill-builder/bills, admin dashboard, push token registration. Root `configureForegroundHandler` in `app/_layout.tsx`.

## Next

1. User to smoke-test APK on Android phone, then approve `eas build -p android --profile production` + `eas submit -p android --latest` (track=internal, releaseStatus=draft per `eas.json`).
2. Apply migration `supabase/migrations/20260423_user_push_tokens.sql` on Supabase before push works.
3. Confirm Supabase → Auth → URL Config has `laundroswipe://auth-callback` or Google OAuth fails silently.

## Context

- `google-services.json` is gitignored + uploaded as EAS file env `GOOGLE_SERVICES_JSON`; `app.config.ts` reads `process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`. `play-service-account.json` at repo root (was `finsyncauth-9aca17a1b0f3.json`), gitignored, referenced from `eas.json` submit profile.
- User pasted Supabase service role key + Google OAuth client secret in chat; ONLY anon key + web client id were written to `.env.local`. Neither secret belongs in mobile.
- Web API is canonical for policy (`/api/orders/create`, `/api/vendor/*`, `/api/admin/*`). Mobile hits Supabase direct only for RLS reads. Token normalization + idempotency fingerprint ported verbatim; do not drift — vendor_bills collisions otherwise.
- Caveman mode active for this user; keep replies terse. Web repo at `/Volumes/T7/code/laundroswipe`. Stitch UI refs in `/Volumes/T7/code/laundroswipe-app/_stitch_refs/`.
