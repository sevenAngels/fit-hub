# Mobile Release Runbook (T23/T30)

Date: 2026-02-23

## Scope

- Internal beta release only (TestFlight + Google Play Internal Track).
- GA promotion is out of scope for this runbook.

## Preconditions

- EAS credentials are configured for both platforms.
- App Store Connect app and Google Play Console app are already created.
- `apps/mobile/app.json` bundle/package identifiers are final.
- Health entitlement/privacy checklist confirmed:
  - `NSHealthShareUsageDescription` set for read-only steps and active calories scope.
  - `NSHealthUpdateUsageDescription` set with MVP no-write policy.
  - iOS target HealthKit capability enabled in Xcode for dev/release builds.
- `apps/mobile/eas.json` preview/production profiles are available.

## Command paths

1. iOS beta build:
   - `npx eas build --platform ios --profile preview --non-interactive`
2. Android beta build:
   - `npx eas build --platform android --profile preview --non-interactive`
3. iOS TestFlight submit:
   - `npx eas submit --platform ios --profile preview --latest --non-interactive`
4. Android Internal Track submit:
   - `npx eas submit --platform android --profile preview --latest --non-interactive`
5. Quality gates before sign-off:
   - `npm run typecheck --workspace apps/mobile`
   - `npm run lint --workspace apps/mobile`
   - `npm run test:run --workspace apps/mobile`
   - `npm run build --workspace apps/mobile`
6. Health branch gate:
   - `npm run release:gates:health`

## Rollback trigger conditions

- Any P0/P1 defect is open.
- Beta build submission fails for either platform.
- Internal tester access path is broken.
- Health gate result is `NO_GO` and fallback decision is not documented.

## Health gate thresholds (T30)

- sync_success_rate_7d >= 95%
- duplicate_rows = 0
- stale_ratio_hours <= 72
- stale_banner_sla_minutes <= 5
- crash_free_7d >= 99.9%
- startup_tti_p95_ms <= 2200

If any threshold fails, execute no-go fallback and continue core release path with health flags off.

## Rollback procedure

1. Stop rollout promotion immediately (do not promote beta build beyond internal).
2. Apply health fallback kill-switch decision:
   - `health:enabled = false`
   - `health:ios = false`
   - `health:android = false`
3. Re-validate core flows with fallback mode:
   - auth, dashboard, record, mood, report
4. Re-issue previous stable build to internal testers:
   - TestFlight/Internal Track에서 직전 stable 빌드 활성화
5. Record owner decision in go/no-go checklist with timestamp and action.

## Owners

- Release owner: `<name>`
- On-call owner: `<name>`
- QA owner: `<name>`

## Output artifacts

- `.sisyphus/evidence/task-23-release-beta.json`
- `.sisyphus/evidence/task-23-release-beta-error.json`
- `.sisyphus/evidence/task-30-health-go-no-go.json`
- `.sisyphus/evidence/task-30-health-go-no-go-error.json`
