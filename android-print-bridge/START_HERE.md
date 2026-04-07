# Build the APK — what you actually do

You **cannot** build the Android app from the Next.js folder alone. You need **Android Studio** (or JDK 17 + Android SDK) once, then you get an **APK file** you can install on a shop tablet.

## 1. Install tools (one time)

1. Install **[Android Studio](https://developer.android.com/studio)** (includes Android SDK).
2. Open Android Studio → **More Actions → SDK Manager** → install **Android 14 (API 34)** SDK Platform (or whatever the project asks for when you sync).

## 2. Open this project

1. In Android Studio: **File → Open** → choose the **`android-print-bridge`** folder inside your LaundroSwipe repo (the folder that contains `app/` and `settings.gradle.kts`).
2. Wait for **Gradle sync** to finish. If it fails:
   - Install **JDK 17**: Android Studio → **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** → pick **Embedded JDK** or **JDK 17**.
   - Create **`local.properties`** in `android-print-bridge/` (copy from `local.properties.example`) and set:
     ```properties
     sdk.dir=/path/to/Android/sdk
     ```
     (On Mac, often `~/Library/Android/sdk`. Android Studio shows the path in SDK Manager.)

## 3. Point the app at your website

Edit:

**`app/src/main/res/values/strings.xml`**

Change **`web_load_url`** to your real admin URL, for example:

```xml
<string name="web_load_url" translatable="false">https://YOUR-DOMAIN.com/admin/vendor</string>
```

Use **`https://`** in production. For a phone on the same Wi‑Fi as your PC during dev, you can use your computer’s LAN IP (and `cleartext` is already allowed in the manifest for that).

You **do not** have to type the printer MAC: on first open the app shows **paired Bluetooth devices** (from Android Settings → Bluetooth). Tap your thermal printer, then **Continue**. Optional: set `printer_bluetooth_mac` in XML for a fixed default, or use **⋮ → Change printer** later.

## 4. Build the APK

**Debug (quick test on a device):**

- Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
- Or terminal from `android-print-bridge/`:
  ```bash
  ./gradlew :app:assembleDebug
  ```
- Output: **`app/build/outputs/apk/debug/app-debug.apk`**

**Release (for shops):**

- **Build → Generate Signed App Bundle or APK** and follow the wizard (create a keystore once and keep it safe), **or**
- Configure signing in `app/build.gradle.kts` and run `./gradlew :app:assembleRelease`.

## 5. Install on the tablet

- Copy the APK to the device (USB, Drive, etc.), open it, allow **Install unknown apps** if asked.
- Open **LaundroSwipe Printer Guide**, allow **Bluetooth** permissions, pick your printer from the **paired devices** list (pair it in Android Settings → Bluetooth first if needed), then **Continue to LaundroSwipe**.
- Log in to your admin site in the WebView and use **Vendor Bill → Print** as usual.

## 6. Let the website offer “Download APK”

After you have a release (or debug) APK:

- **Option A:** Upload it to GitHub Releases / S3 / Drive with a public link → set **`NEXT_PUBLIC_PRINT_BRIDGE_APK_URL`** or **`PRINT_BRIDGE_APK_URL`** in your Next.js env.
- **Option B:** Copy the file to your repo as **`public/downloads/laundroswipe-print-bridge.apk`** and deploy (that path is gitignored by default — add the file in CI or on the server when you deploy).

Then **Admin → Printers** shows **Download APK** and it will work.

---

**Summary:** Install Android Studio → open `android-print-bridge` → set `web_load_url` → Build APK → install on device → set env or `public/downloads/` for the website button.
