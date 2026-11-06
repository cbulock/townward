# Openpolis for Android

The Android client bundles the existing TypeScript/PixiJS game with Capacitor. It supports portrait, landscape and expanded foldable layouts. Local play is unlimited and available offline; guest trials, analytics and network fonts are disabled in native builds. The web build keeps its existing behavior.

## Build

Use Bun 1.4+, Node 22+, Java 21 and an Android SDK with API 36. Set `JAVA_HOME` and `ANDROID_HOME` for your installation. The checked-in Gradle wrapper handles Gradle installation.

```powershell
bun install
bun run android:debug
```

This builds the bundled client, runs Capacitor sync, assembles the debug application and copies it to `artifacts/Openpolis-debug.apk`. Alternatively:

```sh
bun run android:sync
cd android
./gradlew assembleDebug
```

`bun run build` builds the hosted client into `dist/`; `bun run build:native` builds Android assets into `dist-native/`. Re-run `android:sync` after changing client code.

## Controls and storage

Phones use a five-category construction dock, scrollable sheets, 48px touch targets and two customizable summary rows. Each row can select and order any number of controls and statistics; Menu, Rotate and Expand remain fixed. Preferences persist on the device. Expanded layouts retain the desktop HUD.

Touch construction, demolition and relocation require explicit confirmation. Cancel never charges funds. Pinching discards pending placement and remains navigation-only until all fingers lift, including when a second finger lands on a HUD control. Resizing and backgrounding discard unconfirmed construction.

Android Back closes a panel first, then cancels a construction draft, then puts away the selected tool. From the map it offers a saved return to the city menu. Back at the menu exits the application. Backgrounding saves and pauses simulation/audio; returning restores the prior speed without background city progression.

Cities retain the existing IndexedDB store, save format and recovery journal. Keep the application ID `com.openpolis.game` and WebView origin `https://localhost` stable across upgrades. Browser storage is separate and is not automatically imported.

Optional email accounts use the original API at `https://openpolis.space`, with the original save endpoints. Native Capacitor HTTP delegates cookies to Android rather than copying session tokens into web storage. GitHub OAuth is hidden until a native callback flow exists. Server authentication and anti-abuse policies still apply; real-account sign-in against the original deployment requires device acceptance.

Signed-in cities receive local recovery copies before cloud saves and when opened. Opening a device copy detaches it from its cloud mapping, preserving subsequent local edits. Authorization failures never fall back silently to another session. Concurrent edits across devices are not merged.

The launcher and native metadata preserve the Openpolis name and diamond mark. Bundled fonts and the original MIT notice are included under `licenses/`. This PR does not change server code, hosting, database, email delivery or the save-transfer protocol.

## Verification

```sh
bun run test -- --maxWorkers=2 --testTimeout=20000
bun run typecheck
bun run lint
bun run build
bun run build:native
bun run test:android:browser
```

Before browser acceptance, serve the native bundle:

```sh
bun node_modules/vite/bin/vite.js preview --mode native --host 127.0.0.1 --port 5291 --strictPort
```

The browser configuration uses installed Chrome on Windows. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to select another Chromium executable. Tests use controlled API responses and do not prove native cookie persistence or production account compatibility.

Physical Android acceptance remains pending: airplane-mode installation/cold launch, process termination/recovery, update retention, keyboard and system insets, fold transitions and sustained performance on a developed 128×128 city. Desktop browser results cannot establish physical-device frame times or thermal behavior. This is a debug evaluation build; release signing and store publishing are outside its scope.

### Android-only PR validation, 2026-11-05

- The full suite passed 293 unit/integration tests. A later run under concurrent browser/build load passed 292 and timed out one unchanged demo fixture at 20 seconds; both demo tests passed when rerun alone with a 60-second timeout.
- All 18 browser scenarios passed, including local save/reopen, controlled email/cloud responses, offline recovery, HUD customization, portrait/landscape/expanded layouts, Back priority and placement-safe pinch gestures. The mouse regression was verified failing before its correction and passing afterward in a mouse-only context.
- TypeScript, ESLint, hosted/native production builds, Capacitor sync, debug APK assembly and Android lint passed. App lint reported 0 errors and 18 existing template/dependency warnings. Android instrumentation sources compile; they were not executed on a device.
- Review confirmed that strict whole-draft validation applies only to touch confirmation and that the original backend implementation, save endpoints and branding remain intact.
