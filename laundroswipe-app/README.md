# Laundroswipe (unified Expo app)

Customer + staff flows against the same **Supabase** project and **Next.js** API deployed on Vercel.

## Prerequisites

1. **Next.js live** — Production API for this app is **`https://api.laundroswipe.com`** (Vercel + custom domain). Confirm in a browser: `https://api.laundroswipe.com/api/schedule` returns JSON (`{ "slots", "dates" }`). If you see **503**, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` on the Vercel project. If you see **500**, check Vercel logs and Supabase (tables `schedule_slots` / `schedule_dates`, RLS).
2. **Local `.env`** — copy [.env.example](.env.example) to `.env` and set `EXPO_PUBLIC_SUPABASE_*`. `EXPO_PUBLIC_API_BASE_URL` defaults to `https://api.laundroswipe.com` in [eas.json](eas.json) for **EAS builds**; local `expo start` still reads `.env`.
3. **EAS cloud builds** — In [expo.dev](https://expo.dev) → your project → **Environment variables**, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the `preview` (and `production` if needed) environment so APK builds embed real keys. Do **not** commit real keys to GitHub.
4. **Supabase** — Authentication → URL configuration → **Redirect URLs**: add `laundroswipeapp://auth`. Enable the Google provider.

`EXPO_PUBLIC_*` values are embedded at **build** time; change env and **rebuild** the APK after any change.

## Local development

```bash
npm install
npx expo start
```

Use a **development build** or **EAS preview APK** for native Bluetooth printing (`react-native-bluetooth-escpos-printer`); Expo Go does not match that native stack.

## Installable Android APK (EAS)

One-time: [Expo account](https://expo.dev/signup), then from this directory:

```bash
npm install
npm run eas:login
npm run eas:init
```

Commit any new `extra.eas.projectId` (or `.eas/` metadata) that `eas init` adds to the repo so builds stay linked to the same project.

#### `eas init` error: “A project with this slug has previously been created”

That slug already exists on your Expo account. **Link this folder to the existing project** (do not create another with the same name):

1. Open [expo.dev](https://expo.dev) → organization **laundroswipe** → project **laundroswipe-app** → **Project settings** → copy **Project ID** (UUID).
2. From `laundroswipe-app/` run (replace the UUID):

   ```bash
   npx eas-cli init --id YOUR_PROJECT_UUID_HERE --force
   ```

3. Commit whatever the CLI writes (often `extra.eas.projectId` in [`app.config.ts`](app.config.ts) and/or [`.eas/project.json`](.eas/project.json)).

**Alternative:** pick a new slug in [`app.config.ts`](app.config.ts) (`slug: 'laundroswipe-unified'` or similar), then run `npm run eas:init` again to create a *new* Expo project. Only do this if you intentionally want a separate project from the old `laundroswipe-app` one.

Build a **standalone preview APK** (good for sideloading on a physical phone):

```bash
npm run eas:android:preview
```

This uses Expo **internal distribution**: `distribution: "internal"` in [eas.json](eas.json) so the build is a normal installable app (no Metro dev server). Android uses **`buildType: "apk"`** so testers can sideload without Play Console.

When the build finishes on [expo.dev](https://expo.dev):

- **Share the build page URL** with testers; they can open it, download the artifact, and install.
- Or **download the APK** yourself, transfer it to the device (AirDrop / Drive / USB), enable install from unknown sources if needed, and install.
- Optional: [Expo Orbit](https://expo.dev/orbit) can install from the build page over USB (“Open with Orbit”).

- **Profile `preview`** — internal distribution, `buildType: "apk"` (see [eas.json](eas.json)).
- **Profile `development`** — dev client APK (`npm run eas:android:dev-client`); needs Metro for JS.

### Build from GitHub (optional)

Repo workflow [`.github/workflows/eas-android-preview.yml`](../.github/workflows/eas-android-preview.yml) runs `eas build` on **workflow_dispatch**. Add repository secret **`EXPO_TOKEN`** (Expo access token). Ensure the Expo project has **`extra.eas.projectId`** committed (from `eas init`) and **EAS environment variables** for Supabase as above.

## Troubleshooting

### EAS Android build fails in “Run gradlew”

The npm package `react-native-bluetooth-escpos-printer` ships an **obsolete** `android/build.gradle` (old AGP, jcenter, `compileSdk` 27). This repo applies a **`patch-package`** fix under [`patches/react-native-bluetooth-escpos-printer+0.0.5.patch`](patches/react-native-bluetooth-escpos-printer+0.0.5.patch) on every `npm install`. If Gradle still fails, open the EAS log phase **Run gradlew** and search for the first `error:` line.

## Learn more

- [Expo Router](https://docs.expo.dev/router/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
