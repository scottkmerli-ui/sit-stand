# Sit/Stand App — Agent Instructions

## Architecture

- **PWA + Capacitor 8** hybrid: single `index.html` (HTML + CSS + JS) served via Capacitor Android WebView
- **Auto-update**: Web-only changes auto-update via GitHub Pages fetch + localStorage loader + `document.write()`. Native (Kotlin/manifest) changes require new APK install.
- **GitHub repo**: `scottkmerli-ui/sit-stand` (no GPG signing)
- **Native project**: `C:\_not_desktop\sit-stand-native\` (Capacitor Android wrapper)

## Version Management

- `APP_VERSION` in `index.html` = web layer version (auto-updatable)
- `APK_VERSION` in `index.html` = native layer version (must match APK)
- `version.json` on server: `version` (web), `minApkVersion` (gate for web-only updates)
- **Loader** at top of `index.html` uses `cmpVer()` (numeric semver comparison) to load cached HTML from localStorage if newer than bundled
- **NEVER use versions where minor > 9 without confirming loader uses numeric comparison** (string compare was a past bug: '3.10' < '3.8')
- When bumping only web code: bump `APP_VERSION` + `version.json.version`
- When rebuilding APK: bump BOTH `APP_VERSION` and `APK_VERSION`

## Build Commands

```powershell
# Set environment
$env:ANDROID_HOME = "C:\_not_desktop\android-sdk"
$env:JAVA_HOME = "C:\_not_desktop\jdk-21"

# Sync web → native
Copy-Item "C:\_not_desktop\sit-stand\index.html" "C:\_not_desktop\sit-stand-native\www\index.html" -Force
cd "C:\_not_desktop\sit-stand-native"; npx cap sync android

# Build APK
cd "C:\_not_desktop\sit-stand-native\android"; .\gradlew.bat assembleDebug

# Copy APK for distribution
Copy-Item "C:\_not_desktop\sit-stand-native\android\app\build\outputs\apk\debug\app-debug.apk" "C:\_not_desktop\SitStand.apk" -Force
```

## Key Constraints

- **JDK 21** required (system JDK 25 is too new for Gradle 8.9)
- **Kotlin 1.8.22** (forced in resolution strategy)
- **jvmTarget = '17'** must match Java compileOptions
- **minSdk 28** (Health Connect requirement)
- **compileSdk/targetSdk 35**
- Capacitor Plugin method names `checkPermissions`/`requestPermissions` conflict with supertype — must rename (e.g., `checkHcPermissions`, `requestBlePermissions`)

## Native Plugins

| Plugin | File | Purpose |
|--------|------|---------|
| HealthConnectPlugin | `HealthConnectPlugin.kt` | Read steps/HR from Health Connect (Fitbit syncs here) |
| BleHeartRatePlugin | `BleHeartRatePlugin.kt` | Direct BLE connection to Polar H10 for real-time HR |
| AlarmAlertPlugin | `AlarmAlertPlugin.java` | Notifications, permissions, battery optimization |
| ForegroundServicePlugin | `ForegroundServicePlugin.java` | Keep timer alive in background |

## Health Connect Notes

- Fitbit → Health Connect sync lag: **15-30 minutes** (steps are NOT real-time)
- HC permissions require `activity-alias` with `VIEW_PERMISSION_USAGE` intent filter (Android 14+)
- HC permissions must use `PermissionController.createRequestPermissionResultContract()` with `startActivityForResult` — simple intent doesn't work
- Battery optimization dialog requires `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission in manifest
- Poll interval: 120 seconds

## Smart Detection Logic

- **Standing**: sustained steps (30s+) → score 0.5 (triggers suggestion). Brief steps → 0.2 (doesn't trigger alone)
- **Sitting**: no steps for 30s+ → score 0.5; no steps for 2m+ → score 0.6. Threshold to trigger: 0.4
- **Transition time**: estimated from step record timestamps, capped at `state.switchedAt`
- Heart rate signals (from Polar H10 BLE): elevated HR → standing, dropped HR → sitting

## Git Workflow

```powershell
cd "C:\_not_desktop\sit-stand"
git add -A; git commit --no-gpg-sign -m "message"; git push origin main
```

Web changes deploy via GitHub Pages automatically. No CI/CD pipeline — just push to main.

## Common Pitfalls

1. Auto-update won't work if `version.json.minApkVersion` > installed `APK_VERSION`
2. Service worker cache (`sw.js`) must be bumped when changing cache strategy
3. `document.write()` in Capacitor WebView works for in-place replacement but NOT after navigation
4. Uninstall required if APK signing key changes (debug vs release)
5. User distributes APK via Google Drive (no Play Store)
