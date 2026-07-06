# Portier369 Mobile (iOS + Android)

Native app shell built with [Capacitor](https://capacitorjs.com). The app loads
**https://portier369.com** directly (`server.url` in `capacitor.config.ts`), so
every Vercel deploy updates the app content instantly — store re-submission is
only needed when the *native layer* changes (plugins, icons, splash, config).

- App ID: `com.portier369.app` (both stores)
- App name: `Portier369`
- Web deploys = instant app updates. Native changes = new store build.

## Layout

| Path | What it is |
|---|---|
| `capacitor.config.ts` | Single source of truth: app id/name, remote URL, splash/status-bar config |
| `android/` | Complete Android Studio project (icons + splashes already generated) |
| `ios/` | Complete Xcode project (icons + splashes already generated; run `pod install` on a Mac) |
| `assets/logo.png` | 1024px brand icon (exported from the web app's `/icon-1024` route) |
| `www/` | Offline fallback page only — the real UI is the live site |

## Day-to-day commands

```bash
npm install          # once
npx cap sync         # after changing capacitor.config.ts or plugins
npx cap open android # opens Android Studio
npx cap open ios     # opens Xcode (macOS only)
npm run assets       # regenerate icons/splashes after changing assets/logo.png
```

## Building for Google Play

**Already done on this machine (2026-07-06):** a signed release is built —
`mobile/dist/Portier369-1.0-playstore.aab` (upload this to Play Console) and
`mobile/dist/Portier369-1.0-test.apk` (sideload on any Android phone to test).

Signing setup:
- Upload keystore: `C:\Users\autho\portier369-keys\portier369-upload.keystore`
  (password in `keystore-password.txt` next to it).
  **⚠️ BACK BOTH FILES UP somewhere safe (password manager + cloud). Losing
  the keystore means losing the ability to update the app.**
- Gradle reads `android/keystore.properties` (gitignored) for the paths.
- Local toolchain (no Android Studio needed): portable JDK 21 + SDK in
  `C:\Users\autho\android-toolchain\`.

Rebuild after native changes:
```bash
cd mobile/android
JAVA_HOME="C:\Users\autho\android-toolchain\jdk21" ./gradlew bundleRelease
```
Bump `versionCode`/`versionName` in `android/app/build.gradle` for every
Play upload.

Then in [Play Console](https://play.google.com/console) ($25 one-time fee):
create the app → upload the `.aab` → fill the listing (copy in
`store-listing.md`, screenshots in `store-assets/`) → data-safety form
(declare account auth, email collection, Stripe payments) → submit.
Note: **register as an organization** — new personal accounts must run a
14-day/12-tester closed test before production; organization accounts are
exempt.

## Building for the Apple App Store (requires a Mac + Xcode)

1. On the Mac: `sudo gem install cocoapods`, then in `ios/App/`: `pod install`.
2. `npx cap open ios` → set your Team under Signing & Capabilities.
3. Product → Archive → Distribute to App Store Connect.
4. [App Store Connect](https://appstoreconnect.apple.com)
   (Apple Developer Program, $99/yr) → create the app with bundle id
   `com.portier369.app` → fill listing → submit for review.

No Mac? Use a cloud build service (Ionic Appflow, Codemagic, or a GitHub
Actions `macos` runner) to archive and upload.

### Passing Apple review (guideline 4.2 — minimum functionality)

Apple sometimes rejects thin web wrappers. Strengthen the submission:
- Position the app as a **companion for existing customers** (owners, board
  members, vendors, managers) — login-first B2B apps are reviewed as such.
- Provide a **demo login** in the review notes (e.g. a Granville persona).
- The native layer already ships splash screen + status-bar integration;
  push notifications (`@capacitor/push-notifications`) are the highest-value
  native addition if review pushes back.

## Store listing assets

- 1024px icon: already in `ios/App/App/Assets.xcassets` / exported from
  `https://portier369.com/icon-1024`.
- Screenshots: take from the deployed site at phone size (390×844) for the
  owner portal, work orders, payments, and board views.

## What was deliberately left out (v1)

- **Push notifications** — needs FCM + APNs keys; add `@capacitor/push-notifications` when ready.
- **Biometric login** — needs a native auth bridge; the web session cookie persists in the webview, so users stay signed in.
- **Offline mode** — the app is a live client for a multi-tenant SaaS; `www/index.html` shows a branded reconnect screen if there's no network.
