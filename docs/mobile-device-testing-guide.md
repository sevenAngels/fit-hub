# Mobile Device Testing and Build Guide

Date: 2026-02-23

## Scope

- Purpose: run real-device validation for mobile tasks (including T25 HealthKit permission flow).
- This guide assumes local repo path: `fit-hub`.

## Prerequisites

1. Node 20.19.4+ installed.
2. Expo account and EAS login completed.
3. iOS real device + Apple Developer account (for HealthKit testing).
4. `apps/mobile/.env` configured from `apps/mobile/.env.example`.
5. iOS HealthKit capability enabled in Apple signing profile/Xcode target.

## Your required actions before real device testing

Use this checklist in order. If one step fails, stop and fix it before moving forward.

1. Fill mobile app env values in `apps/mobile/.env`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_API_BASE_URL`
   - `EXPO_PUBLIC_WEB_BASE_URL`
   - keep health flags as needed for your test scope
2. For runtime script checks (T19/T20), export required shell vars before running commands:
   - minimum for T19 runtime: `T19_SUPABASE_URL`, `T19_SUPABASE_ANON_KEY`, `T19_USER_A_ACCESS_TOKEN`
   - recommended for full T19 coverage: `T19_USER_A_ID`, `T19_USER_B_ACCESS_TOKEN`, `T19_USER_B_ID`, `T19_REVOKED_ACCESS_TOKEN`
   - for T20 runtime mode: `E2E_RUNTIME=true` (plus device-specific vars if needed)
3. Log in to EAS on your machine:
   - `npx eas whoami`
   - if not logged in: `npx eas login`
4. Confirm local baseline commands all pass before building:
   - `npm ci`
   - `npm run typecheck --workspace apps/mobile`
   - `npm run lint --workspace apps/mobile`
   - `npm run test:run --workspace apps/mobile`
5. Build and install dev client on your target device (iOS or Android), then connect Metro.
6. Run manual app flows checklist (below) and capture screenshots/video for failures.
7. After manual test, rerun evidence scripts and update task evidence files.

## Install and baseline checks

1. Install dependencies:
   - `npm ci`
2. Run baseline verification:
   - `npm run typecheck --workspace apps/mobile`
   - `npm run lint --workspace apps/mobile`
   - `npm run test:run --workspace apps/mobile`

## Build and run on iOS device (Dev Client)

1. Build iOS dev client:
   - `npx eas build --platform ios --profile development --non-interactive`
2. Install the build on device:
   - Open the EAS build page URL from CLI output on iPhone.
   - Install the app via TestFlight/internal distribution path shown by EAS.
3. Start Metro for dev client:
   - `npm --prefix apps/mobile run start -- --dev-client`
4. Launch installed dev client app on device and connect to the running Metro server.

## Build and run on Android device (Dev Client)

1. Build Android dev client:
   - `npx eas build --platform android --profile development --non-interactive`
2. Install APK/AAB test artifact from EAS build output.
3. Start Metro for dev client:
   - `npm --prefix apps/mobile run start -- --dev-client`
4. Open installed app on device and connect to Metro.

## Manual functional checklist before F1 (focus: T1-T23)

Run these in the app UI after install. Record pass/fail for each item.

1. Auth and guard flow:
   - unauthenticated access is redirected to sign-in
   - sign-in succeeds and protected routes open
   - sign-out returns to unauthenticated state
2. Onboarding and routing:
   - onboarding step progression works end-to-end
   - app resumes correctly if onboarding is interrupted
3. Record pipeline:
   - record upload screen opens
   - image picker/camera path works (permission + selection)
   - upload progress and result state are shown without crash
4. Core feature screens:
   - dashboard renders
   - goals/habits render and interaction paths respond
   - mood screen renders and save path works
   - profile/avatar screen renders and update path is reachable
   - report screen opens and weekly report flow is reachable
5. Subscription/release fallback paths:
   - subscription screen renders fallback state without blocking core screens
   - app still navigates across dashboard/report/mood after subscription fallback conditions

## Runtime script checks you should run before device session ends

1. T19 security smoke:
   - dry-run: `npm run test:security:rls:dry-run`
   - runtime (requires env): `npm run test:security:rls`
2. T20 E2E core suite:
   - dry-run: `npm run test:e2e:core:dry-run`
   - runtime: `npm run test:e2e:core`
3. T21/T22/T23 support checks:
   - `npm run test:observability`
   - `npm run test:subscription:fallback`
   - `npm run test:release:beta`

## T25 iOS HealthKit test procedure

1. Sign in and open dashboard.
2. Go to `Open health connect`.
3. Grant path:
   - If status is `notDetermined`, tap `Connect HealthKit`.
   - Grant read permission for Steps + Active Calories.
   - Confirm status changes to `Connected`.
4. Denied/revoked path:
   - Revoke permission in iOS Settings/Health.
   - Return to app and confirm fallback text + `Open iOS Settings` CTA.
5. Startup non-blocking check:
   - Relaunch app and verify auth/onboarding/dashboard render without HealthKit prompt blocking startup.

## Evidence update commands after device run

1. Regenerate static contract evidence:
   - `npm run test:healthkit:permission`
2. Update task evidence notes manually if runtime artifacts were captured:
   - `.sisyphus/evidence/task-25-healthkit-permission.md`
   - `.sisyphus/evidence/task-25-healthkit-permission.json`
   - `.sisyphus/evidence/task-25-healthkit-permission-error.json`

## Troubleshooting

- If HealthKit permission prompt does not appear:
  - Confirm iOS device build is a dev/release build (not Expo Go).
  - Confirm HealthKit capability is enabled for the app identifier.
- If app cannot connect to Metro:
  - Ensure device and dev machine are on reachable network.
  - Restart Metro: `npm --prefix apps/mobile run start -- --dev-client --clear`.
