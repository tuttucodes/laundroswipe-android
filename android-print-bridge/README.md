# LaundroSwipe Android print bridge

**→ Step-by-step for humans: [START_HERE.md](./START_HERE.md)** (install Android Studio, set URL, build APK, host download).

**LaundroSwipe Printer Guide** — Material onboarding to pick a **paired** Bluetooth printer (no typing MAC), then a WebView that loads your admin URL and exposes  
`window.LaundroSwipeAndroidPrint.printEscPosBase64(...)` for **Classic Bluetooth (SPP)** printers.

Printing uses **[DantSu/ESCPOS-ThermalPrinter-Android](https://github.com/DantSu/ESCPOS-ThermalPrinter-Android)** (MIT) via JitPack: [`BluetoothConnection`](https://github.com/DantSu/ESCPOS-ThermalPrinter-Android/blob/master/escposprinter/src/main/java/com/dantsu/escposprinter/connection/bluetooth/BluetoothConnection.java) handles pairing/UUID selection; we send **raw ESC/POS** with [`DeviceConnection.write`](https://github.com/DantSu/ESCPOS-ThermalPrinter-Android/blob/master/escposprinter/src/main/java/com/dantsu/escposprinter/connection/DeviceConnection.java) + `send()` so the web app’s bytes pass through unchanged.

## Requirements

- **JDK 17** to run Gradle (Android Studio’s bundled JBR is fine). Command line: `export JAVA_HOME=…` to a JDK 17 install — **JDK 8 will fail** plugin resolution for AGP 8.x.
- Android **SDK** (install via Android Studio; copy `local.properties.example` → `local.properties` and set `sdk.dir`)
- Printer paired in **Android system Bluetooth settings**
- Dependency: `com.github.DantSu:ESCPOS-ThermalPrinter-Android:3.3.0` (see `app/build.gradle.kts`)

## Configure

1. Edit `app/src/main/res/values/strings.xml`:
   - `web_load_url` — your deployed site, e.g. `https://yoursite.com/admin/vendor`
   - `printer_bluetooth_mac` — optional default MAC; leave `00:00:00:00:00:00` to use the in-app device picker

2. Open the **`android-print-bridge`** folder in Android Studio, sync Gradle, run on a device.

3. Build debug APK: `./gradlew :app:assembleDebug`  
   Build signed release: **Build → Generate Signed Bundle / APK** in Android Studio, or `./gradlew :app:assembleRelease` after configuring signing in `app/build.gradle.kts`.

## Host the APK for your team

The Next.js app shows a **Download APK** button on **Admin → Printers** and **Vendor Bill**.

1. **Recommended:** Set `NEXT_PUBLIC_PRINT_BRIDGE_APK_URL` in Vercel/env to a stable URL (GitHub Releases, S3, etc.).
2. **Or** copy `app/build/outputs/apk/release/app-release.apk` (or debug) to the web repo as  
   `public/downloads/laundroswipe-print-bridge.apk` (see `public/downloads/HOWTO-APK.txt`).  
   `*.apk` under `public/downloads/` is gitignored by default so you don’t commit large binaries; upload that file as part of deploy or attach it in CI.

## Project layout

| Path | Purpose |
|------|---------|
| `app/src/main/java/.../PrintBridge.kt` | `JavascriptInterface` + DantSu `BluetoothConnection` |
| `app/src/main/java/.../MainActivity.kt` | Paired-device picker UI, WebView, BT permissions (Android 12+) |
| `app/src/main/java/.../BluetoothPrinterDevices.kt` | Bonded device list + printer heuristics |
| `app/build.gradle.kts` | JitPack + DantSu dependency |

## Web contract

Implemented in repo root `lib/native-print-bridge.ts`:

```text
window.LaundroSwipeAndroidPrint.printEscPosBase64(base64: string): boolean
```

## Security

- Use **HTTPS** for `web_load_url` in production.
- This app is equivalent to logging into admin in a browser; protect the device.

## Why not “silent” auto-MAC?

Android does not expose a stable way to know which bonded device is *your* receipt printer without user confirmation. This app lists **paired** devices, sorts likely thermal printers to the top (imaging class + name hints), and saves the address you tap—no manual typing unless you use **Enter address manually**.
