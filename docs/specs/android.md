# Android client

## Scope

Package the existing TypeScript simulation, PixiJS renderer and React UI in a Capacitor Android application. Keep Openpolis branding, the existing hosted API and browser behavior. Do not change the simulation, save format, backend, hosting, account policy or email delivery.

Local city creation, opening and saving must work offline without a guest time limit. Bundle game assets, fonts and their licenses. Optional email accounts use the existing API through native HTTP. Hide GitHub OAuth until an Android callback flow exists. Android account compatibility, including production anti-abuse controls and persistent cookies, requires device acceptance.

## Layout and input

- Support portrait at 360×640 CSS pixels, short landscape at 640×360 and expanded foldable/tablet layouts. Do not block native portrait play with the browser's rotation prompt.
- Phones use a five-category construction dock, one scrollable sheet and two customizable summary rows. Keep controls at least 48×48 CSS pixels. Menu, Rotate and Expand stay fixed while selected summary items can scroll.
- Persist row selections and order on the device. Apply saves draft preferences; Cancel discards them. Reset stages defaults until Apply. A storage failure must not block play.
- Finger drawing, demolition and relocation create drafts. Explicit confirmation rechecks validity and funds before applying the whole draft. Cancel makes no world change and charges nothing. Preserve existing mouse construction behavior.
- Pinch cancels construction and remains navigation-only until all fingers lift. A second finger on a HUD control joins navigation rather than activating that control. Rotation preserves a draft; viewport resizing and backgrounding discard it.

## Android lifecycle and storage

Back first dismisses an open dialog or panel, then cancels a draft, then puts away the selected tool. On the map, offer to save and return to the city menu. At the menu, allow the application to exit.

Backgrounding saves, pauses simulation and mutes audio. Resume restores the prior speed and sound state, including an intentional pause, without running elapsed background time. Handle overlapping WebView and native lifecycle events once.

Retain IndexedDB and the synchronous recovery journal. Keep the application ID `com.openpolis.game` and origin `https://localhost` stable across upgrades. Browser storage is separate; automatic browser import is outside scope.

Before cloud saves and after cloud loads, preserve a device recovery copy. Opening that copy detaches it from the cloud mapping so later cloud activity cannot overwrite local edits. Only network failures can fall back to a device copy; authorization failures must remain errors. Do not merge concurrent edits across devices.

## Architecture and performance

Use `MODE=native` to select bundled assets, native API transport and platform behavior. Native builds write `dist-native/`; hosted builds keep `dist/`. Keep platform handling outside `src/sim/`. Maintain original MIT attribution and bundled font licenses.

The phone HUD consumes existing event-backed Jotai state. Input adds pointer/gesture state but no new polling loop. Lifecycle work runs on transitions. Measure the developed 128×128 demo in the headless budget harness and compare browser frame cadence with the unchanged upstream baseline. Report the runtime, viewport and rendering limitations; software-rendered desktop results cannot establish physical Android 60 FPS or thermal endurance.

## Acceptance

Automated checks cover native/web platform separation, interrupted input, safe pinch transitions, draft confirmation/cancellation, lifecycle state, HUD preference migration, existing API transport and local cloud recovery. Browser checks cover phone orientations, expanded layouts, offline menu/play, local save/reopen, Back priority, controlled account responses and mouse behavior. TypeScript, ESLint, hosted/native builds and Android assembly/lint must pass.

Physical-device acceptance remains open: airplane-mode cold launch, process termination/recovery, update retention, system and keyboard insets, fold transitions, real-account cookie persistence and sustained developed-city performance. Release signing and Play publishing are outside scope.

Build and validation details: [Android workflow](../ANDROID.md). Upstream submission checklist and measurements: [contribution readiness](../ANDROID-UPSTREAM.md).
