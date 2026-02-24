# Diet Hub PWA -> React Native Migration (Ultrawork Plan)

## TL;DR

> **Quick Summary**: Rebuild Diet Hub from Next.js PWA into an Expo-based React Native app by reusing Supabase backend, and prioritize health integration (Apple HealthKit / Android Health Connect for steps and active calories) as a core migration objective.
>
> **Deliverables**:
> - React Native app skeleton + authenticated core MVP flows (Auth, Onboarding, Record, Dashboard, Goals/Habits, Mood, Profile, Weekly Report)
> - Health integration MVP+ scope: daily steps and active-calorie sync with permission/revocation-safe UX
> - Preflight decision artifacts (auth transport, deep links, report dependency map, contract drift fixes)
> - Automated quality gates (unit/integration/E2E, RLS/storage smoke, release checklist)
>
> **Estimated Effort**: Large (8 weeks strict MVP; 7-10 weeks with stabilization buffer)
> **Parallel Execution**: YES - 4 waves + final verification wave
> **Critical Path**: T1 -> T3 -> T7 -> T9 -> T12 -> T24 -> T26 -> T28 -> T20 -> T23

## Current Progress Snapshot (2026-02-23)

- Completed: **Wave 1 (T1-T6)**, **Wave 2 (T7-T12)**, **T13 implementation patch**, **T14 implementation patch**, **T15 implementation patch**, **T16 implementation patch**, **T17 implementation patch**, **T18 implementation patch**, **T19 implementation patch**, **T20 implementation patch**, **T21 implementation patch**, **T22 implementation patch**, **T23 implementation patch**, **T24 implementation patch**, **T25 implementation patch**, **T26 implementation patch**, **T27 implementation patch**, **T28 implementation patch**, **T29 implementation patch**, **T30 implementation patch**
- In progress now: **Wave 4 (health integration implementation ongoing)**
- Next executable tasks: **F1**
- Latest evidence summary: `.sisyphus/evidence/task-30-health-go-no-go.md`
- Resume entry points:
  - Plan document: `docs/diet-hub-rn-migration-ultrawork.md`
  - Active state: `.sisyphus/boulder.json`
  - First next target: `F1. Plan Compliance Audit`

## AI 재시작 가이드 (한국어)

- **어디까지 완료?** Wave 1(T1-T6), Wave 2(T7-T12) 완료 + T13/T14/T15/T16/T17/T18/T19/T20/T21/T22/T23/T24/T25/T26/T27/T28/T29/T30 구현 패치 완료(디바이스 QA 증적 대기)
- **체크리스트 상태 요약** `T1~T12 = [x]`, `T13 = [ ](QA deferred)`, `T14 = [ ](QA deferred)`, `T15 = [ ](QA deferred)`, `T16 = [ ](QA deferred)`, `T17 = [ ](QA deferred)`, `T18 = [ ](QA deferred)`, `T19 = [ ](QA deferred)`, `T20 = [ ](QA deferred)`, `T21 = [ ](QA deferred)`, `T22 = [ ](QA deferred)`, `T23 = [ ](QA deferred)`, `T24 = [ ](QA deferred)`, `T25 = [ ](QA deferred)`, `T26 = [ ](QA deferred)`, `T27 = [ ](QA deferred)`, `T28 = [ ](QA deferred)`, `T29 = [ ](QA deferred)`, `T30 = [ ](QA deferred)`, `F1~F4 = [ ]`
- **다음에 무엇부터?** `F1. Plan Compliance Audit`부터 진행
- **바로 열어볼 파일(우선순위)**
  - `apps/mobile/src/features/health/service.ts`
  - `apps/mobile/src/features/health/queries.ts`
  - `apps/mobile/app/(protected)/health.tsx`
  - `apps/mobile/src/features/health/*`
  - `.sisyphus/evidence/task-30-health-go-no-go.md`
- **다음 작업 목표(F1)**
  - T1~T30 must-have/must-not-have 충족 여부를 evidence 기준으로 감사
  - 누락 항목/오버빌드/교차 오염 여부를 verdict 형태로 정리
  - F2/F3/F4 선행 검증 입력(테스트/QA/스코프 감사 데이터) 고정
- **다음 시작 순서(Top 3)**
  1. `F1` Plan Compliance Audit
      - 우선 파일: `.sisyphus/evidence/*`, `docs/diet-hub-rn-migration-ultrawork.md`
  2. `F2` Code Quality Review
      - 우선 파일: `apps/mobile/*`, `scripts/*`, `.github/workflows/*`
  3. `F3` Real QA Replay
      - 우선 파일: `.maestro/*`, `docs/mobile-device-testing-guide.md`, `.sisyphus/evidence/*`
- **재검증 명령(작업 후 필수)**
  - `npm run typecheck --workspace apps/mobile`
  - `npm run lint --workspace apps/mobile`
  - `npm run test:run --workspace apps/mobile`
  - `npm run build --workspace apps/mobile`
- **증적 업데이트 위치** `.sisyphus/evidence/task-13-record-feature-completion.md`, `.sisyphus/evidence/task-14-dashboard-aggregation.md`, `.sisyphus/evidence/task-15-goals-habits.md`, `.sisyphus/evidence/task-16-mood-upsert.md`, `.sisyphus/evidence/task-17-profile-avatar.md`, `.sisyphus/evidence/task-18-weekly-report.md`, `.sisyphus/evidence/task-19-rls-smoke.md`, `.sisyphus/evidence/task-20-e2e-suite.md`, `.sisyphus/evidence/task-21-observability.md`, `.sisyphus/evidence/task-22-subscription-fallback.md`, `.sisyphus/evidence/task-23-release-beta.md`, `.sisyphus/evidence/task-24-health-contract.md`, `.sisyphus/evidence/task-25-healthkit-permission.md`, `.sisyphus/evidence/task-26-healthconnect-available.md`, `.sisyphus/evidence/task-27-sync-idempotency.md`, `.sisyphus/evidence/task-28-health-ui.md`, `.sisyphus/evidence/task-29-compliance-package.md`, `.sisyphus/evidence/task-30-health-go-no-go.md`
- **런타임 QA 상태** 사내 환경에서 에뮬레이터/실디바이스 미사용으로 Maestro 시나리오 증적은 후속 실행으로 이연
- **나중 확인 작업(간단 메모)**
  - T18 happy path: 주간 리포트 생성 -> 상세 렌더 확인
  - T18 failure path: empty-week 생성 -> 명시적 empty UX 확인
  - `/report` 진입 시 `/feedback` 리다이렉트 동작 확인
  - T19 real smoke: `npm run test:security:rls` 실행 후 evidence json(pass/fail) 확인
  - T19 stale/revoked token: `T19_REVOKED_ACCESS_TOKEN` 사용해 401/403 검증
  - T19 cross-user denial: `T19_USER_B_ID` (+ optional `T19_USER_B_GOAL_ID`)로 데이터 누출/수정 차단 확인
  - T20 runtime suite: `E2E_RUNTIME=true npm run test:e2e:core` 실행해 iOS/Android 결과 수집
  - T20 strict health gate: `E2E_HEALTH_REQUIRED=true`로 health 흐름 strict pass 여부 확인
  - T20 contract-break artifact: `E2E_INJECT_CONTRACT_BREAK=true`로 error evidence 생성 확인
  - T21 runtime ingestion: staging에서 startup/upload/api-error 이벤트가 telemetry backend에 수집되는지 확인
  - T21 crash hook: synthetic non-fatal/fatal 이벤트로 Sentry alert/stack trace 확인
  - T22 active/inactive status: 구독 상태 표시가 계정 상태와 일치하는지 실디바이스 확인
  - T22 checkout return path: 웹 결제 취소/복귀 시 앱 상태 안정 + 재시도 CTA 확인
  - T23 beta submit: iOS TestFlight / Android Internal Track 실제 제출 및 테스터 접근 확인
  - T23 rollback drill: 런북 절차로 rollback 복구 시간 측정 및 owner sign-off 기록
  - T24 contract completeness: `npm run test:health:contract` 실행 결과 PASS 재확인
  - T25 iOS runtime grant path: iOS 실디바이스에서 권한 승인 후 connected 상태/동기화 상태 확인
  - T25 iOS denied/revoked path: settings CTA 복구 및 non-blocking core flow 확인
  - T26 android provider available path: provider/permission/read precheck ok + connected 상태 확인
  - T26 android unavailable/update path: install/update guidance + non-blocking fallback 확인
- **참고 공식 문서(재시작 시 우선 확인)**
  - Supabase RN Auth Quickstart: `https://supabase.com/docs/guides/auth/quickstarts/react-native`
  - Supabase Mobile Deep Linking: `https://supabase.com/docs/guides/auth/native-mobile-deep-linking`
  - Expo Router Authentication (Protected Routes): `https://docs.expo.dev/router/advanced/authentication/`

---

## Context

### Original Request
Analyze three planning docs under `docs/`, reference sibling `diet-hub` PWA codebase as needed, and produce an ultrawork-level execution plan for React Native migration.

### Interview Summary
**Key Discussions**:
- Migration target is React Native with Expo workflow and MVP-first scope.
- Existing backend/db should be reused; avoid full DB redesign.
- Server Actions are not directly reusable on RN and require migration mapping.
- Health integration (steps/active calories) is elevated from backlog to primary migration objective.

**Research Findings**:
- Core migration specs: `docs/react-native-rebuild-spec.md`, `docs/react-native-weekly-ticket-plan.md`, `docs/react-native-mvp-checklist.md`.
- Existing implementation signals from sibling codebase: `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/*.ts`, `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/api/**/route.ts`, `/Users/javadreamer/Develop/Nextjs/diet-hub/src/middleware.ts`, `/Users/javadreamer/Develop/Nextjs/diet-hub/next.config.ts`.

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Auth transport ambiguity (cookie vs bearer vs direct Supabase) -> solved via explicit preflight decision gate + bearer bridge acceptance checks.
- Deep-link/reset path mismatch risk -> solved via dedicated deep-link contract task with real-device E2E criteria.
- Type/schema drift (`food_name_ko`) -> solved via contract cleanup task with single type-source enforcement.
- Hidden Server Action coupling -> solved via mandatory action replacement matrix before module implementation.
- Health priority gap (previously Post-MVP) -> solved via dedicated health wave (T24-T30) with performance and compliance gates.

---

## Work Objectives

### Core Objective
Deliver a production-ready React Native MVP that preserves core Diet Hub behavior and adds reliable health-data integration (steps/active calories) with strict performance and compliance gates.

### Concrete Deliverables
- `apps/mobile` Expo project with strict TypeScript and modular feature architecture.
- Stable auth/session/deep-link flows on iOS/Android real devices.
- Core MVP feature parity across record/dashboard/goals/mood/profile/report.
- Health metrics ingestion pipeline: iOS HealthKit + Android Health Connect to daily normalized aggregates.
- Release artifacts: beta build pipeline, runbook, rollback and go/no-go checklist.

### Definition of Done
- [ ] Preflight blockers resolved with executable evidence files under `.sisyphus/evidence/`.
- [ ] MVP acceptance scenarios pass on iOS and Android.
- [ ] Release gate checks pass with P0/P1 issues at zero.

### Must Have
- DB reuse with Supabase RLS/storage model preserved.
- Mobile-safe auth/session strategy (no cookie-only assumptions).
- Strict MVP scope freeze with Post-MVP backlog separation.
- Health integration in release scope: read-only steps + active calories with permission/revocation-safe fallback.

### Must NOT Have (Guardrails)
- No `service-role` key shipped in mobile app code/config.
- No direct reuse of Next Server Actions from mobile runtime.
- No scope creep into advanced community/monthly premium/offline queue features during MVP.
- No direct Samsung Health SDK path in MVP (Android uses Health Connect bridge only).
- No startup-blocking health sync, no raw-event persistence, no write-back to health providers in MVP.

### Version Baseline (Pinned for MVP)

> Principle: avoid bleeding edge while staying modern. Lock this baseline first, then upgrade only by explicit gate.

- **Runtime/Tooling**:
  - Node.js: `20.19.4` minimum (`22.x LTS` allowed in local dev if CI parity passes)
  - npm: `10.x`
  - TypeScript: `5.8.x`
- **Core RN stack**:
  - Expo SDK: `54.x` (baseline lane)
  - React Native: `0.81.x` (Expo SDK 54 aligned)
  - React: `19.1.x` (Expo SDK 54 aligned)
  - Expo Router: `6.0.23` or newer patch in `6.0.x` line
- **Data/State/Form**:
  - `@supabase/supabase-js`: `2.95.x`
  - `@tanstack/react-query`: `5.90.x`
  - `zustand`: `5.0.x`
  - `zod`: `4.3.x`
  - `react-hook-form`: `7.71.x`
- **Expo native modules (install via expo resolver)**:
  - `expo-secure-store`: SDK 54 compatible pinned version
  - `expo-image-picker`: SDK 54 compatible pinned version
  - `expo-notifications`: SDK 54 compatible pinned version
- **Observability**:
  - `@sentry/react-native`: `7.x` (Expo SDK 54 compatibility-validated patch)
- **Health integration libs**:
  - iOS: `@kingstinct/react-native-healthkit@13.2.x`
  - Android: `react-native-health-connect@3.5.x` + `expo-health-connect@0.1.1`

**Upgrade Gate (Optional)**:
- Evaluate Expo SDK `55.x` only after MVP beta baseline is green for 2 consecutive weeks.
- Promotion criteria: no health-permission regressions, no startup regression, no breaking peer dependency drift.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - all verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (web has Vitest; mobile setup required)
- **Automated tests**: YES (Tests-after default + mandatory integration/E2E gates)
- **Framework**: Vitest (+ RN testing library) + Maestro/Detox E2E + curl contract checks

### QA Policy
- Every task includes explicit QA scenarios (happy path + failure path), tool choice, assertions, and evidence path.
- Evidence target root: `.sisyphus/evidence/`.
- Frontend mobile verification: Maestro/Detox + screenshots/logs.
- API/backend verification: curl + response assertions.
- Contract/type verification: test + lint + TS diagnostics.
- Health module verification: permission denied/revoked/provider-unavailable/timezone-boundary/idempotent-sync scenarios are mandatory.
- Compliance verification: App Store Privacy and Play Data Safety artifact checks are required before release.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Preflight + Foundation): T1-T6
Wave 2 (Identity + Core Data Plumbing): T7-T12
Wave 3 (Feature Migration Core): T13-T18
Wave 4 (Health Integration Priority): T24-T28
Wave 5 (Hardening + Release): T19-T23, T29-T30
Wave FINAL (Independent Review): F1-F4

Critical Path: T1 -> T3 -> T7 -> T9 -> T12 -> T24 -> T26 -> T28 -> T20 -> T23
Parallel Speedup: ~70-75% vs fully sequential
Max Concurrent: 7

### Dependency Matrix

- **T1**: Blocked By None -> Blocks T3, T8, T9, T11
- **T2**: Blocked By None -> Blocks T3, T11, T18
- **T3**: Blocked By T1, T2 -> Blocks T8-T18
- **T4**: Blocked By None -> Blocks T7-T18
- **T5**: Blocked By T4 -> Blocks T7-T12, T19
- **T6**: Blocked By T4, T5 -> Blocks T20-T23
- **T7**: Blocked By T4, T5 -> Blocks T8-T18
- **T8**: Blocked By T1, T3, T7 -> Blocks T10, T13-T18
- **T9**: Blocked By T1, T7, T8 -> Blocks T10, T20
- **T10**: Blocked By T8, T9 -> Blocks T14, T15, T16
- **T11**: Blocked By T1, T2, T5 -> Blocks T12-T18
- **T12**: Blocked By T7, T8, T11 -> Blocks T13, T14, T18
- **T13**: Blocked By T8, T11, T12 -> Blocks T14, T20
- **T14**: Blocked By T10, T12, T13 -> Blocks T20, T21
- **T15**: Blocked By T10, T11 -> Blocks T20
- **T16**: Blocked By T10, T11 -> Blocks T20
- **T17**: Blocked By T8, T11 -> Blocks T20
- **T18**: Blocked By T2, T3, T8, T11, T12 -> Blocks T20, T22
- **T19**: Blocked By T5, T11, T13-T18 -> Blocks T20-T23
- **T20**: Blocked By T6, T9, T13-T19, T27, T28 -> Blocks T23, F1-F4
- **T21**: Blocked By T14, T19 -> Blocks T23, F1-F4
- **T22**: Blocked By T18, T19 -> Blocks T23, F1-F4
- **T23**: Blocked By T6, T19-T22, T28-T30 -> Blocks F1-F4
- **T24**: Blocked By T4, T5, T7 -> Blocks T25-T28, T30
- **T25**: Blocked By T24 -> Blocks T26, T29, T30
- **T26**: Blocked By T24, T25, T11 -> Blocks T27, T28, T29, T30
- **T27**: Blocked By T26, T14 -> Blocks T20, T29
- **T28**: Blocked By T26, T27 -> Blocks T20, T23, F1-F4
- **T29**: Blocked By T19, T25, T26, T27 -> Blocks T23, F1-F4
- **T30**: Blocked By T22, T25, T26, T29 -> Blocks T23, F1-F4

### Agent Dispatch Summary

- **Wave 1**: 6 tasks - `deep`(T1,T3), `unspecified-high`(T2,T5,T6), `quick`(T4)
- **Wave 2**: 6 tasks - `unspecified-high`(T7,T11,T12), `visual-engineering`(T8,T10), `deep`(T9)
- **Wave 3**: 6 tasks - `visual-engineering`(T13,T14,T17), `unspecified-high`(T15,T16,T18)
- **Wave 4**: 5 tasks - `deep`(T24,T26), `unspecified-high`(T25,T27), `visual-engineering`(T28)
- **Wave 5**: 7 tasks - `deep`(T19,T22,T23,T30), `unspecified-high`(T20,T29), `quick`(T21)
- **Final**: 4 tasks - `oracle`(F1), `unspecified-high`(F2,F3), `deep`(F4)

---

## TODOs

- [x] 1. Preflight Decision Gate (Auth/DeepLink/Report/Notifications)

  **What to do**:
  - Finalize auth transport decision: RN direct Supabase for CRUD + Bearer bridge for protected Next APIs.
  - Freeze deep-link contract (reset-password, verify-email, callback routes, iOS/Android link schemes).
  - Freeze report dependency map (`/report` -> `/feedback`) and notification scope (Post-MVP default).
  - Produce signed preflight artifact in `.sisyphus/evidence/task-1-preflight-contracts.md`.

  **Must NOT do**:
  - Start feature coding before P0 contracts are frozen.

  **Recommended Agent Profile**:
  - **Category**: `deep` - cross-cutting architectural decision risk.
  - **Skills**: `ui-ux-pro-max`, `playwright`
  - **Skills Evaluated but Omitted**: `writing` (insufficient technical validation depth).

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T4)
  - **Blocks**: T3, T8, T9, T11
  - **Blocked By**: None

  **References**:
  - `docss/react-native-mvp-checklist.md` - explicit preflight blocker list and acceptance gates.
  - `docss/react-native-weekly-ticket-plan.md` - Week 0 blocker ordering.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/middleware.ts` - existing protected/auth route behavior to preserve.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/supabase/middleware.ts` - cookie-session assumptions that RN cannot rely on.

  **Acceptance Criteria**:
  - [ ] Preflight decision doc exists with chosen contract and rollback fallback.
  - [ ] `grep -n "PRE-00" docss/react-native-weekly-ticket-plan.md` mapped to decision rows in evidence.

  **QA Scenarios**:
  ```text
  Scenario: Contract matrix complete (happy)
    Tool: Bash
    Preconditions: docs available locally
    Steps:
      1. Validate evidence file exists at .sisyphus/evidence/task-1-preflight-contracts.md
      2. Check it contains sections: auth transport, deep-link map, report dependency, notification scope
      3. Assert each section has selected option + rationale + owner
    Expected Result: all four sections present and non-empty
    Failure Indicators: missing section or unresolved "TBD"
    Evidence: .sisyphus/evidence/task-1-contract-check.txt

  Scenario: Unresolved blocker detection (failure)
    Tool: Bash
    Preconditions: same evidence file
    Steps:
      1. Search for "TBD|DECISION NEEDED|UNKNOWN" in evidence file
      2. Assert zero matches
    Expected Result: 0 unresolved markers
    Evidence: .sisyphus/evidence/task-1-contract-check-error.txt
  ```

  **Commit**: YES (groups with 2,3)
  - Message: `chore(migration): freeze preflight architecture contracts`

- [x] 2. Type/Schema Contract Unification and Drift Fix Plan

  **What to do**:
  - Enforce `database.types.ts` as single source of DB truth.
  - Create migration fix ticket for `food_name_ko` drift in feedback flow.
  - Mark `src/types/supabase.ts` as legacy/deprecated and block new usage.

  **Must NOT do**:
  - Introduce alternate DB type files for convenience.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - contract integrity and data correctness.
  - **Skills**: `typescript`, `supabase`
  - **Skills Evaluated but Omitted**: `visual-engineering` (non-UI task).

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T4)
  - **Blocks**: T3, T11, T18
  - **Blocked By**: None

  **References**:
  - `docss/react-native-mvp-checklist.md` - type source standardization requirement.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/types/database.types.ts` - canonical schema types.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/types/supabase.ts` - legacy source to forbid.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/api/feedback/generate/route.ts` - known field mismatch point.

  **Acceptance Criteria**:
  - [ ] Drift report saved at `.sisyphus/evidence/task-2-contract-drift.md` with exact mismatch list.
  - [ ] Static check command for forbidden import path is documented and passing.

  **QA Scenarios**:
  ```text
  Scenario: Single type source enforced (happy)
    Tool: Bash
    Preconditions: codebase indexed
    Steps:
      1. Search for imports from src/types/supabase.ts
      2. Assert result count is 0 for new/modified mobile code paths
      3. Verify contract drift report lists food_name_ko mismatch with fix owner
    Expected Result: no forbidden imports + drift item tracked
    Failure Indicators: any active usage of legacy type source
    Evidence: .sisyphus/evidence/task-2-type-source.txt

  Scenario: Drift unresolved (failure)
    Tool: Bash
    Preconditions: same
    Steps:
      1. Validate drift report has status column
      2. Assert no row remains in "unassigned" state
    Expected Result: all drift rows assigned and dated
    Evidence: .sisyphus/evidence/task-2-type-source-error.txt
  ```

  **Commit**: YES (groups with 1,3)
  - Message: `chore(contracts): unify db type source and drift ledger`

- [x] 3. Server Action Replacement Matrix

  **What to do**:
  - Inventory all `src/lib/actions/*.ts` exports and map each to one of: Direct Supabase, Next API, Edge Function.
  - Identify caching/revalidation behavior to replicate in RN query invalidation.
  - Produce matrix for all MVP actions before implementation.

  **Must NOT do**:
  - Start module migration without replacement owner for each action.

  **Recommended Agent Profile**:
  - **Category**: `deep` - dependency mapping and migration safety.
  - **Skills**: `typescript`, `supabase`
  - **Skills Evaluated but Omitted**: `artistry` (conventional systems mapping).

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after T1,T2)
  - **Blocks**: T8-T18
  - **Blocked By**: T1, T2

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/auth.actions.ts` - auth flows.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/meal.actions.ts` - record and upload behavior.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/report.actions.ts` - report dependency complexity.
  - `docss/react-native-rebuild-spec.md` - prescribed conversion patterns (direct/API/edge).

  **Acceptance Criteria**:
  - [ ] Matrix file exists: `.sisyphus/evidence/task-3-server-action-matrix.md`.
  - [ ] Every exported action from MVP modules has target migration path and owner.

  **QA Scenarios**:
  ```text
  Scenario: Complete action coverage (happy)
    Tool: Bash
    Preconditions: matrix generated
    Steps:
      1. Count exported async functions in src/lib/actions/*.ts
      2. Count matrix rows for MVP modules
      3. Assert matrix rows >= export count for scoped modules
    Expected Result: 100% mapped actions
    Failure Indicators: unmatched action names
    Evidence: .sisyphus/evidence/task-3-matrix-coverage.txt

  Scenario: Unowned migration path (failure)
    Tool: Bash
    Preconditions: matrix exists
    Steps:
      1. Search matrix for empty owner/path cells
      2. Assert 0 incomplete rows
    Expected Result: no blank ownership
    Evidence: .sisyphus/evidence/task-3-matrix-coverage-error.txt
  ```

  **Commit**: YES
  - Message: `chore(migration): add server-action replacement matrix`

- [x] 4. Expo Mobile Skeleton and Directory Baseline

  **What to do**:
  - Create `apps/mobile` Expo app with strict TS and prescribed module layout.
  - Implement base folders: `app`, `features`, `infrastructure`, `shared`, `entities`.
  - Add routing shell for `(auth)` and `(protected)` groups.
  - Apply Version Baseline lock (Expo 54 lane + explicit dependency bands).

  **Must NOT do**:
  - Add feature business logic in scaffold task.

  **Recommended Agent Profile**:
  - **Category**: `quick` - scaffolding and conventions.
  - **Skills**: `expo-router`, `typescript`
  - **Skills Evaluated but Omitted**: `deep` (not required for scaffold).

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1,T2)
  - **Blocks**: T7-T18
  - **Blocked By**: None

  **References**:
  - `docss/react-native-rebuild-spec.md` - target module structure.
  - `docss/react-native-mvp-checklist.md` - repository/app skeleton checklist.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/package.json` - existing scripts and quality baseline.

  **Acceptance Criteria**:
  - [ ] `apps/mobile` exists with strict TS enabled.
  - [ ] Route groups `(auth)` and `(protected)` build without runtime route errors.
  - [ ] `apps/mobile/package.json` reflects Version Baseline dependency bands.

  **QA Scenarios**:
  ```text
  Scenario: Skeleton boots (happy)
    Tool: interactive_bash
    Preconditions: Expo deps installed
    Steps:
      1. Run mobile dev command in tmux
      2. Open simulator and load app root
      3. Assert no red-screen and route shell renders
    Expected Result: app boot success with base routes
    Failure Indicators: type compile failure or route not found
    Evidence: .sisyphus/evidence/task-4-skeleton-boot.txt

  Scenario: Strict mode regression (failure)
    Tool: Bash
    Preconditions: mobile workspace present
    Steps:
      1. Run TypeScript check command
      2. Assert zero errors
    Expected Result: TS strict passes
    Evidence: .sisyphus/evidence/task-4-skeleton-boot-error.txt
  ```

  **Commit**: YES
  - Message: `feat(mobile): bootstrap expo project skeleton`

- [x] 5. Environment Profiles and Secret Handling Policy

  **What to do**:
  - Define `dev/staging/prod` environment profile strategy for Expo/EAS.
  - Configure `EXPO_PUBLIC_*` variables and secure secret distribution for private keys.
  - Add policy checks: service-role key never bundled in mobile app.

  **Must NOT do**:
  - Expose server-side secrets in client-readable config.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - release/security infrastructure.
  - **Skills**: `expo`, `security`
  - **Skills Evaluated but Omitted**: `visual-engineering`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (after T4; parallel with T6)
  - **Blocks**: T7-T12, T19
  - **Blocked By**: T4

  **References**:
  - `docss/react-native-mvp-checklist.md` - env rule (`EXPO_PUBLIC_*`) and security baseline.
  - `docss/react-native-rebuild-spec.md` - service-role prohibition.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/utils/env.ts` - current env usage pattern.

  **Acceptance Criteria**:
  - [ ] Profile table documented with keys per environment and owner.
  - [ ] Secret audit command proves no service-role key in mobile code/config.

  **QA Scenarios**:
  ```text
  Scenario: Env profiles resolve correctly (happy)
    Tool: Bash
    Preconditions: profile config added
    Steps:
      1. Build profile config for dev/staging/prod
      2. Validate required keys exist and optional keys default safely
      3. Assert missing required key fails fast with explicit message
    Expected Result: deterministic env resolution by profile
    Failure Indicators: silent fallback to empty secrets
    Evidence: .sisyphus/evidence/task-5-env-profiles.txt

  Scenario: Secret leakage detection (failure)
    Tool: Bash
    Preconditions: repository indexed
    Steps:
      1. Search mobile workspace for service-role key identifiers
      2. Assert zero hits in tracked files
    Expected Result: no service-role tokens in mobile
    Evidence: .sisyphus/evidence/task-5-env-profiles-error.txt
  ```

  **Commit**: YES
  - Message: `chore(mobile): add env profiles and secret policy`

- [x] 6. CI Baseline and Build Verification for Mobile Workspace

  **What to do**:
  - Add CI steps for mobile lint/type/test/build sanity.
  - Add artifact retention for QA evidence and failed logs.
  - Ensure branch checks block merge on core failures.

  **Must NOT do**:
  - Allow optional failures for type/lint/test in main pipeline.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - CI reliability.
  - **Skills**: `ci-cd`, `typescript`
  - **Skills Evaluated but Omitted**: `artistry`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (after T4,T5)
  - **Blocks**: T20-T23
  - **Blocked By**: T4, T5

  **References**:
  - `docss/react-native-weekly-ticket-plan.md` - stabilization/release expectations.
  - `docss/react-native-mvp-checklist.md` - QA and release gates.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/package.json` - existing test/lint script conventions.

  **Acceptance Criteria**:
  - [ ] CI workflow for mobile branch exists and executes lint/type/test/build.
  - [ ] Failed jobs upload logs to `.sisyphus/evidence/failures/`.

  **QA Scenarios**:
  ```text
  Scenario: CI happy path (happy)
    Tool: Bash
    Preconditions: CI config merged in branch
    Steps:
      1. Trigger CI pipeline on test commit
      2. Assert lint/type/test/build jobs all succeed
      3. Verify artifacts uploaded
    Expected Result: green pipeline with artifact links
    Failure Indicators: skipped mandatory job or missing artifact
    Evidence: .sisyphus/evidence/task-6-ci-happy.txt

  Scenario: Failing check blocks merge (failure)
    Tool: Bash
    Preconditions: CI branch protection enabled
    Steps:
      1. Trigger intentional type error branch
      2. Assert CI fails and merge is blocked
    Expected Result: protection rule enforced
    Evidence: .sisyphus/evidence/task-6-ci-failure.txt
  ```

  **Commit**: YES
  - Message: `chore(ci): enforce mobile quality gate pipeline`

- [x] 7. Supabase RN Client + Secure Session + Query Persist

  **What to do**:
  - Implement RN Supabase client with `expo-secure-store` session persistence.
  - Set TanStack Query cache and persistence strategy (read cache MVP).
  - Add token refresh failure handler with forced logout flow.

  **Must NOT do**:
  - Store sensitive secrets outside secure storage layer.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - auth/data foundation.
  - **Skills**: `supabase`, `tanstack-query`
  - **Skills Evaluated but Omitted**: `quick` (risky auth surface).

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential start of Wave 2
  - **Blocks**: T8-T18
  - **Blocked By**: T4, T5

  **References**:
  - `docss/react-native-rebuild-spec.md` - secure-store/session/data principles.
  - `docss/react-native-mvp-checklist.md` - auth/session acceptance criteria.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/supabase/client.ts` - existing Supabase client config baseline.

  **Acceptance Criteria**:
  - [ ] App restart restores session in <=2 seconds on cached path.
  - [ ] Refresh failure reliably transitions to logged-out state.

  **QA Scenarios**:
  ```text
  Scenario: Session restore works (happy)
    Tool: Maestro
    Preconditions: valid authenticated session exists
    Steps:
      1. Launch app, login with test account
      2. Kill app and relaunch
      3. Assert protected home appears within 2s
    Expected Result: auto-restored session and protected route access
    Failure Indicators: redirect to login or spinner timeout
    Evidence: .sisyphus/evidence/task-7-session-restore.json

  Scenario: Token refresh failure logout (failure)
    Tool: Maestro
    Preconditions: expired/invalid refresh token mocked
    Steps:
      1. Relaunch app with invalid refresh token
      2. Assert forced logout + user-facing error message
    Expected Result: clean sign-out without crash loop
    Evidence: .sisyphus/evidence/task-7-session-restore-error.json
  ```

  **Commit**: YES
  - Message: `feat(auth): add supabase rn session foundation`

- [x] 8. Auth Screens + Route Guards + Session UX

  **What to do**:
  - Implement login/signup screens with zod form validation.
  - Add route guarding for `(auth)` and `(protected)` groups.
  - Align redirect behavior with web logic (onboarding incomplete -> onboarding).

  **Must NOT do**:
  - Hardcode bypass paths that skip auth guards.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - UI + navigation state interaction.
  - **Skills**: `ui-ux-pro-max`, `expo-router`
  - **Skills Evaluated but Omitted**: `writing`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T11 after T7)
  - **Blocks**: T10, T13-T18
  - **Blocked By**: T1, T3, T7

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/middleware.ts` - auth/onboarding redirect behavior.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/auth.actions.ts` - auth flow semantics.
  - `docss/react-native-rebuild-spec.md` - Auth module success criteria.

  **Acceptance Criteria**:
  - [ ] Login/signup flows succeed and route correctly by auth/onboarding status.
  - [ ] Network/auth errors display deterministic user-facing messages.

  **QA Scenarios**:
  ```text
  Scenario: Login guard flow (happy)
    Tool: Maestro
    Preconditions: valid account + onboarding completed
    Steps:
      1. Open login screen, fill email/password, submit
      2. Assert navigation to protected dashboard route
      3. Relaunch app and assert still protected (session restore)
    Expected Result: login and guarded access work
    Failure Indicators: auth success but wrong route
    Evidence: .sisyphus/evidence/task-8-auth-guard.json

  Scenario: Invalid credentials (failure)
    Tool: Maestro
    Preconditions: invalid password
    Steps:
      1. Submit wrong password
      2. Assert localized error text and no protected navigation
    Expected Result: blocked access with clear error
    Evidence: .sisyphus/evidence/task-8-auth-guard-error.json
  ```

  **Commit**: YES
  - Message: `feat(auth-ui): implement mobile auth screens and guards`

- [x] 9. Deep-Link Reset/Verify End-to-End Contract Implementation

  **What to do**:
  - Implement and verify deep-link routing for password reset and email verification.
  - Align Supabase redirect URLs with mobile schemes/universal links.
  - Cover cold-start and warm-start link handling.

  **Must NOT do**:
  - Ship deep-link paths without real-device validation on both platforms.

  **Recommended Agent Profile**:
  - **Category**: `deep` - auth edge-case and platform routing.
  - **Skills**: `expo-router`, `supabase`
  - **Skills Evaluated but Omitted**: `quick`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential in Wave 2
  - **Blocks**: T10, T20
  - **Blocked By**: T1, T7, T8

  **References**:
  - `docss/react-native-mvp-checklist.md` - deep-link blocker and acceptance criteria.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/auth.actions.ts` - reset URL expectation.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/auth/callback/route.ts` - existing callback behavior baseline.

  **Acceptance Criteria**:
  - [ ] reset/verify deep-link opens correct screen and completes action.
  - [ ] invalid/expired link handled gracefully with retry path.

  **QA Scenarios**:
  ```text
  Scenario: Valid reset deep-link (happy)
    Tool: Maestro
    Preconditions: issued valid password reset link for test user
    Steps:
      1. Launch app via reset deep-link URL
      2. Enter new password and submit
      3. Assert success message and redirect to login/protected flow
    Expected Result: reset completes successfully
    Failure Indicators: link opens wrong route or token rejected unexpectedly
    Evidence: .sisyphus/evidence/task-9-deeplink-reset.json

  Scenario: Expired token deep-link (failure)
    Tool: Maestro
    Preconditions: expired link token
    Steps:
      1. Launch with expired deep-link
      2. Assert error message and "request new link" action available
    Expected Result: graceful failure without crash
    Evidence: .sisyphus/evidence/task-9-deeplink-reset-error.json
  ```

  **Commit**: YES
  - Message: `feat(auth): implement deep-link reset and verification flow`

- [x] 10. Onboarding Flow (3-Step + Resume + Completion Routing)

  **What to do**:
  - Build onboarding screens for basic/body/MBTI data.
  - Implement step-save and resume behavior.
  - Enforce completion flag routing to dashboard.

  **Must NOT do**:
  - Treat onboarding as complete without required body info.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - multi-screen form flow.
  - **Skills**: `ui-ux-pro-max`, `react-hook-form`
  - **Skills Evaluated but Omitted**: `artistry`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (after T8,T9)
  - **Blocks**: T14, T15, T16
  - **Blocked By**: T8, T9

  **References**:
  - `docss/react-native-rebuild-spec.md` - onboarding fields and success criteria.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/onboarding.actions.ts` - existing save semantics.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/middleware.ts` - onboarding gating logic.

  **Acceptance Criteria**:
  - [ ] Step progress persists and resumes after app restart.
  - [ ] Completion transitions to dashboard only when required data valid.

  **QA Scenarios**:
  ```text
  Scenario: Resume onboarding after interruption (happy)
    Tool: Maestro
    Preconditions: user created, onboarding incomplete
    Steps:
      1. Complete step 1 and partially step 2
      2. Force close app and relaunch
      3. Assert app returns to last incomplete step with saved values
    Expected Result: resumable onboarding
    Failure Indicators: onboarding resets to first step
    Evidence: .sisyphus/evidence/task-10-onboarding-resume.json

  Scenario: Missing required body data (failure)
    Tool: Maestro
    Preconditions: step with empty height/weight
    Steps:
      1. Attempt completion with invalid body inputs
      2. Assert validation error and blocked completion
    Expected Result: cannot complete onboarding with invalid data
    Evidence: .sisyphus/evidence/task-10-onboarding-resume-error.json
  ```

  **Commit**: YES
  - Message: `feat(onboarding): add stepwise onboarding with resume`

- [x] 11. Shared API Client and Bearer Auth Bridge for Next APIs

  **What to do**:
  - Build mobile API client wrapper with bearer token injection and normalized errors.
  - Implement protected API compatibility for `/api/meal/upload`, `/api/avatar/upload`, `/api/feedback/*`, `/api/subscription*`.
  - Add retries, timeout, and idempotency key hooks for upload/report-sensitive endpoints.

  **Must NOT do**:
  - Call protected APIs without explicit auth context.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - transport/security correctness.
  - **Skills**: `typescript`, `supabase`
  - **Skills Evaluated but Omitted**: `ui-ux-pro-max`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (after T1,T2,T5)
  - **Blocks**: T12-T18
  - **Blocked By**: T1, T2, T5

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/api/meal/upload/route.ts` - upload endpoint behavior.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/api/avatar/upload/route.ts` - avatar API contract.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/api/feedback/generate/route.ts` - feedback endpoint constraints.
  - `docss/react-native-weekly-ticket-plan.md` - PRE-001 auth contract requirement.

  **Acceptance Criteria**:
  - [ ] Authorized API calls succeed with bearer path and return expected status codes.
  - [ ] Unauthorized calls return deterministic 401/403 handling in client wrapper.

  **QA Scenarios**:
  ```text
  Scenario: Authorized upload call succeeds (happy)
    Tool: Bash (curl)
    Preconditions: valid bearer token and test payload
    Steps:
      1. Call POST /api/meal/upload with Authorization header
      2. Assert HTTP 200/201 and response contains mealId + image URL
      3. Save response body JSON for traceability
    Expected Result: protected endpoint accepts mobile token flow
    Failure Indicators: 401 despite valid token
    Evidence: .sisyphus/evidence/task-11-api-client-auth.json

  Scenario: Missing token request (failure)
    Tool: Bash (curl)
    Preconditions: no Authorization header
    Steps:
      1. Call same endpoint without token
      2. Assert HTTP 401/403 with structured error body
    Expected Result: unauthorized path handled safely
    Evidence: .sisyphus/evidence/task-11-api-client-auth-error.json
  ```

  **Commit**: YES
  - Message: `feat(api): add bearer bridge client for mobile endpoints`

- [x] 12. Record Upload Adapter (Image Picker/Compression/Progress)

  **What to do**:
  - Implement image acquisition pipeline (camera/gallery) and pre-upload processing.
  - Connect to `POST /api/meal/upload` with progress UI and retry handling.
  - Normalize response into mobile record domain model.

  **Must NOT do**:
  - Block UI indefinitely when upload/analysis fails.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - media/network workflow reliability.
  - **Skills**: `expo-image-picker`, `typescript`
  - **Skills Evaluated but Omitted**: `writing`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (after T7,T8,T11)
  - **Blocks**: T13, T14, T18
  - **Blocked By**: T7, T8, T11

  **References**:
  - `docss/react-native-rebuild-spec.md` - Record feature and upload behavior.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/api/meal/upload/route.ts` - server-side validation and payload contract.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/utils/image-compression.ts` - existing web compression expectations.

  **Acceptance Criteria**:
  - [ ] Upload progress updates visibly and completes under expected network conditions.
  - [ ] Retry path recovers from transient network failure.

  **QA Scenarios**:
  ```text
  Scenario: Meal upload with progress (happy)
    Tool: Maestro
    Preconditions: authenticated user, valid photo asset
    Steps:
      1. Open record flow, select meal type, pick image
      2. Submit upload and watch progress indicator
      3. Assert success result screen with analysis summary
    Expected Result: upload and analysis complete successfully
    Failure Indicators: stalled progress >30s without timeout UI
    Evidence: .sisyphus/evidence/task-12-upload-progress.json

  Scenario: Network drop during upload (failure)
    Tool: Maestro
    Preconditions: network disabled mid-upload
    Steps:
      1. Start upload then disable network
      2. Assert error UI with retry action
      3. Re-enable network and retry; assert success
    Expected Result: graceful fail + successful retry
    Evidence: .sisyphus/evidence/task-12-upload-progress-error.json
  ```

  **Commit**: YES
  - Message: `feat(record): add mobile upload adapter and retry`

- [ ] 13. Record Feature Completion (Result Edit/Delete + History Sync)

  **What to do**:
  - Implement analysis result confirmation/edit flow and record persistence updates.
  - Build date-based history list and detail retrieval.
  - Ensure deletion/update syncs cache and dashboard dependencies.

  **Must NOT do**:
  - Keep stale cached records after delete/update.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - data UI + interaction states.
  - **Skills**: `ui-ux-pro-max`, `tanstack-query`
  - **Skills Evaluated but Omitted**: `artistry`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T15,T16,T17)
  - **Blocks**: T14, T20
  - **Blocked By**: T8, T11, T12

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/meal.actions.ts` - record CRUD and summary behaviors.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/(protected)/record/page.tsx` - current user flow baseline.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/(protected)/record/history/page.tsx` - history UX behavior.

  **Acceptance Criteria**:
  - [ ] Record create/update/delete reflected in history within one refresh cycle.
  - [ ] Error/retry states available for all networked record operations.

  **QA Scenarios**:
  ```text
  Scenario: Create and see history entry (happy)
    Tool: Maestro
    Preconditions: upload flow available (T12 complete)
    Steps:
      1. Complete record upload and confirm result
      2. Open history for same date
      3. Assert new record row appears with correct meal type/date
    Expected Result: history reflects new record
    Failure Indicators: missing row after successful save
    Evidence: .sisyphus/evidence/task-13-record-history.json

  Scenario: Delete record and cache invalidation (failure)
    Tool: Maestro
    Preconditions: existing record row
    Steps:
      1. Delete selected record
      2. Refresh history list
      3. Assert deleted record absent and no stale card remains
    Expected Result: deletion fully propagated
    Evidence: .sisyphus/evidence/task-13-record-history-error.json
  ```

  **Commit**: YES
  - Message: `feat(record): complete result and history management`

- [ ] 14. Dashboard Aggregation + Partial Fallback UX

  **What to do**:
  - Implement dashboard summary cards (today nutrition, goals progress, streak, mood).
  - Add partial-data fallback behavior when one data source fails.
  - Optimize cache-first rendering target for <=2s on warm path.

  **Must NOT do**:
  - Fail entire dashboard render on partial query error.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - multi-widget data UI.
  - **Skills**: `ui-ux-pro-max`, `tanstack-query`
  - **Skills Evaluated but Omitted**: `quick`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (after T10,T12,T13)
  - **Blocks**: T20, T21
  - **Blocked By**: T10, T12, T13

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/dashboard.actions.ts` - aggregation logic.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/(protected)/dashboard/page.tsx` - widget baseline.
  - `docss/react-native-rebuild-spec.md` - dashboard performance target and fallback requirement.

  **Acceptance Criteria**:
  - [ ] Warm-cache dashboard render <=2s on reference device.
  - [ ] Single-panel failure shows local fallback without crashing full screen.

  **QA Scenarios**:
  ```text
  Scenario: Warm cache dashboard speed (happy)
    Tool: Maestro
    Preconditions: user logged in with cached dashboard queries
    Steps:
      1. Launch app to dashboard
      2. Capture time to first complete card render
      3. Assert <=2s threshold
    Expected Result: meets warm-cache target
    Failure Indicators: threshold exceeded or blank widgets
    Evidence: .sisyphus/evidence/task-14-dashboard-speed.json

  Scenario: Partial API failure fallback (failure)
    Tool: Bash + Maestro
    Preconditions: one dashboard API call mocked to fail
    Steps:
      1. Open dashboard with one failed dependency
      2. Assert unaffected cards render and failed card shows fallback state
    Expected Result: resilient partial render
    Evidence: .sisyphus/evidence/task-14-dashboard-speed-error.json
  ```

  **Commit**: YES
  - Message: `feat(dashboard): add aggregate cards with fallback states`

- [ ] 15. Goals/Habits Module Migration with Direction Validation

  **What to do**:
  - Port weight and calorie goal workflows with bulk/cut direction validation.
  - Implement habit add/toggle/list behavior.
  - Ensure dashboard updates after goal/habit mutations.

  **Must NOT do**:
  - Allow logically invalid goal directions to persist.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - domain validation logic.
  - **Skills**: `typescript`, `supabase`
  - **Skills Evaluated but Omitted**: `visual-engineering`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T13,T16,T17)
  - **Blocks**: T20
  - **Blocked By**: T10, T11

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/goals.actions.ts` - weight/habit behavior and validations.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/utils/program-goal.ts` - direction logic.
  - `docss/react-native-mvp-checklist.md` - goals acceptance rule.

  **Acceptance Criteria**:
  - [ ] Invalid bulk/cut goal direction blocked with clear error message.
  - [ ] Habit completion toggles persist by date without duplicates.

  **QA Scenarios**:
  ```text
  Scenario: Valid goal + habit cycle (happy)
    Tool: Maestro
    Preconditions: authenticated user
    Steps:
      1. Set valid target weight/calories
      2. Add habit and toggle complete for today
      3. Assert dashboard reflects updated progress
    Expected Result: goal and habit flows persist correctly
    Failure Indicators: no dashboard update after save
    Evidence: .sisyphus/evidence/task-15-goals-habits.json

  Scenario: Invalid goal direction (failure)
    Tool: Maestro
    Preconditions: bulk goal with non-increasing target
    Steps:
      1. Submit invalid combination
      2. Assert save blocked and specific validation message shown
    Expected Result: invalid data prevented
    Evidence: .sisyphus/evidence/task-15-goals-habits-error.json
  ```

  **Commit**: YES
  - Message: `feat(goals): migrate goals and habits domain logic`

- [ ] 16. Mood Module Migration with Date Upsert Semantics

  **What to do**:
  - Build daily mood entry UI and persistence (stress/sleep fields included).
  - Preserve date-based upsert behavior to avoid duplicate same-day records.
  - Wire mood summary signal to dashboard feedback contexts.

  **Must NOT do**:
  - Insert duplicate mood rows for same date/user.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - data consistency focus.
  - **Skills**: `supabase`, `typescript`
  - **Skills Evaluated but Omitted**: `artistry`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T13,T15,T17)
  - **Blocks**: T20
  - **Blocked By**: T10, T11

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/mood.actions.ts` - upsert and retrieval semantics.
  - `docss/react-native-rebuild-spec.md` - Mood feature success condition.
  - `docss/react-native-mvp-checklist.md` - same-date re-save acceptance.

  **Acceptance Criteria**:
  - [ ] Same-day mood re-save updates existing row (no duplicates).
  - [ ] Mood state reflected in dashboard summary.

  **QA Scenarios**:
  ```text
  Scenario: Daily mood save/update (happy)
    Tool: Maestro
    Preconditions: authenticated user
    Steps:
      1. Save mood for today
      2. Edit same day mood and save again
      3. Assert latest values shown with one daily entry
    Expected Result: idempotent same-day update
    Failure Indicators: duplicate entries in list/query
    Evidence: .sisyphus/evidence/task-16-mood-upsert.json

  Scenario: Invalid mood payload (failure)
    Tool: Bash (curl)
    Preconditions: direct API/data layer validation route
    Steps:
      1. Submit out-of-range stress/sleep value
      2. Assert validation error response and no write
    Expected Result: bad input rejected
    Evidence: .sisyphus/evidence/task-16-mood-upsert-error.json
  ```

  **Commit**: YES
  - Message: `feat(mood): migrate daily mood upsert workflow`

- [ ] 17. Profile and Avatar Migration

  **What to do**:
  - Implement profile read/edit screen and validation.
  - Integrate avatar upload via `POST /api/avatar/upload`.
  - Handle unsupported/oversized image errors with clear UX.

  **Must NOT do**:
  - Assume any uploaded file type is valid image data.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - profile UI + media upload UX.
  - **Skills**: `ui-ux-pro-max`, `expo-image-picker`
  - **Skills Evaluated but Omitted**: `deep`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T13,T15,T16)
  - **Blocks**: T20
  - **Blocked By**: T8, T11

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/profile.actions.ts` - profile/avatar behavior.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/api/avatar/upload/route.ts` - avatar API validation contract.
  - `docss/react-native-mvp-checklist.md` - profile/avatar acceptance expectations.

  **Acceptance Criteria**:
  - [ ] Profile updates persist and reflect immediately in profile screen.
  - [ ] Invalid/oversize avatar shows explicit error and does not overwrite existing avatar.

  **QA Scenarios**:
  ```text
  Scenario: Valid avatar upload (happy)
    Tool: Maestro
    Preconditions: user authenticated, valid png/jpeg asset
    Steps:
      1. Open profile edit, select valid image
      2. Submit upload
      3. Assert avatar preview updates and persists after reload
    Expected Result: avatar URL updated successfully
    Failure Indicators: stale image after refresh
    Evidence: .sisyphus/evidence/task-17-profile-avatar.json

  Scenario: Unsupported/large image (failure)
    Tool: Maestro
    Preconditions: invalid format or oversized file
    Steps:
      1. Attempt upload with unsupported asset
      2. Assert descriptive error and unchanged avatar
    Expected Result: safe rejection path
    Evidence: .sisyphus/evidence/task-17-profile-avatar-error.json
  ```

  **Commit**: YES
  - Message: `feat(profile): migrate profile edit and avatar upload`

- [ ] 18. Weekly Report and Feedback Dependency Migration

  **What to do**:
  - Port weekly report list/detail/create trigger flow.
  - Preserve dependency behavior with feedback/report structure.
  - Ensure report service path no longer relies on unported server-action internals.

  **Must NOT do**:
  - Build report UI on unresolved data-source ambiguity.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - complex data dependency migration.
  - **Skills**: `typescript`, `supabase`
  - **Skills Evaluated but Omitted**: `quick`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential end of Wave 3
  - **Blocks**: T20, T22
  - **Blocked By**: T2, T3, T8, T11, T12

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/report.actions.ts` - report logic source.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/(protected)/report/page.tsx` - report->feedback redirect behavior.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/(protected)/feedback/page.tsx` - feedback/report UX coupling.
  - `docss/react-native-weekly-ticket-plan.md` - `MOB-030A` dependency migration requirement.

  **Acceptance Criteria**:
  - [ ] Weekly report fetch and generation flow succeeds for valid period.
  - [ ] No-data week state renders explicit empty UX.

  **QA Scenarios**:
  ```text
  Scenario: Weekly report generation and view (happy)
    Tool: Maestro
    Preconditions: user has minimum weekly meal data
    Steps:
      1. Open report section and trigger weekly generation
      2. Open generated report detail
      3. Assert summary metrics and feedback blocks render
    Expected Result: stable report generation and display
    Failure Indicators: generation success but blank detail screen
    Evidence: .sisyphus/evidence/task-18-weekly-report.json

  Scenario: Empty-week report request (failure)
    Tool: Maestro
    Preconditions: week with no meal data
    Steps:
      1. Request report for empty week
      2. Assert clear empty-state message and no crash
    Expected Result: graceful no-data UX
    Evidence: .sisyphus/evidence/task-18-weekly-report-error.json
  ```

  **Commit**: YES
  - Message: `feat(report): migrate weekly report and feedback dependencies`

- [ ] 19. Security Baseline + RLS/Storage Smoke Validation

  **What to do**:
  - Execute RLS/storage smoke tests for core CRUD and uploads early (not end-only).
  - Validate logout/cache wipe policy, token handling, and secure-store boundaries.
  - Add checks for multi-device auth invalidation and stale token handling.

  **Must NOT do**:
  - Defer RLS/storage authorization validation to final week.

  **Recommended Agent Profile**:
  - **Category**: `deep` - security and data authorization.
  - **Skills**: `supabase`, `security`
  - **Skills Evaluated but Omitted**: `visual-engineering`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 sequential foundation
  - **Blocks**: T20-T23
  - **Blocked By**: T5, T11, T13-T18

  **References**:
  - `docss/react-native-mvp-checklist.md` - security baseline and early RLS smoke requirement.
  - `docss/react-native-weekly-ticket-plan.md` - `MOB-020A` RLS/storage smoke test.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/types/database.types.ts` - table/relationship reference.

  **Acceptance Criteria**:
  - [ ] Core RLS scenarios pass: own-data access allowed, cross-user access denied.
  - [ ] Storage upload/download permissions conform to user-scope policy.

  **QA Scenarios**:
  ```text
  Scenario: Authorized CRUD and upload (happy)
    Tool: Bash (curl)
    Preconditions: valid user token and owned resource ids
    Steps:
      1. Execute create/read/update/delete on scoped resources
      2. Upload avatar/meal image to allowed bucket path
      3. Assert all responses success for owned scope
    Expected Result: authorized user can manage own data
    Failure Indicators: 403 on owned resource
    Evidence: .sisyphus/evidence/task-19-rls-smoke.json

  Scenario: Cross-user access denied (failure)
    Tool: Bash (curl)
    Preconditions: token from user A, resource belongs to user B
    Steps:
      1. Request B's resource with A token
      2. Assert 401/403 and no leaked payload
    Expected Result: strict deny with safe error
    Evidence: .sisyphus/evidence/task-19-rls-smoke-error.json
  ```

  **Commit**: YES
  - Message: `test(security): add rls and storage smoke validation`

- [ ] 20. Core E2E Automation (MVP + Health Critical Flows)

  **What to do**:
- Automate five required E2E scenarios across auth/onboarding/record/dashboard/report.
- Add health-specific E2E scenarios (connect, denied, revoked, stale fallback).
  - Run on iOS and Android pipelines.
  - Store deterministic artifacts (videos/logs/json results).

  **Must NOT do**:
  - Mark MVP done with simulator-only manual checks.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - cross-platform QA orchestration.
  - **Skills**: `maestro`, `playwright`
  - **Skills Evaluated but Omitted**: `quick`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 sequential
  - **Blocks**: T23, F1-F4
  - **Blocked By**: T6, T9, T13-T19, T27, T28

  **References**:
  - `docss/react-native-rebuild-spec.md` - mandatory E2E scenario list.
  - `docss/react-native-mvp-checklist.md` - QA release gates.
  - `docss/react-native-weekly-ticket-plan.md` - `MOB-033` requirement.

  **Acceptance Criteria**:
- [ ] Five E2E flows pass on both iOS and Android.
- [ ] Health E2E flows pass on both platforms or trigger documented NO_GO fallback path.
  - [ ] Failure artifacts captured automatically for failing scenarios.

  **QA Scenarios**:
  ```text
  Scenario: Full happy-path suite (happy)
    Tool: Bash
    Preconditions: test env seeded with valid accounts/data
    Steps:
      1. Run E2E suite command for iOS profile
      2. Run E2E suite command for Android profile
      3. Assert pass count equals expected 5x2 flows
    Expected Result: all critical flows pass on both platforms
    Failure Indicators: any P0 flow failing
    Evidence: .sisyphus/evidence/task-20-e2e-suite.json

  Scenario: Contract break detection (failure)
    Tool: Bash
    Preconditions: introduce known auth or API contract fault in staging branch
    Steps:
      1. Re-run suite
      2. Assert suite fails with traceable scenario id and stored logs
    Expected Result: deterministic fail-fast with artifact capture
    Evidence: .sisyphus/evidence/task-20-e2e-suite-error.json
  ```

  **Commit**: YES
  - Message: `test(e2e): automate critical mobile flow suite`

- [ ] 21. Performance and Observability Hardening

  **What to do**:
- Instrument startup, upload latency, API error rates, and crash metrics.
- Instrument health sync metrics: success rate, stale ratio, permission-state distribution, provider availability.
  - Configure Sentry and one analytics provider (PostHog or Firebase Analytics).
  - Optimize bottlenecks for cold start and upload target budgets.

  **Must NOT do**:
  - Ship without active crash/error monitoring.

  **Recommended Agent Profile**:
  - **Category**: `quick` - focused instrumentation and tuning.
  - **Skills**: `sentry`, `analytics`
  - **Skills Evaluated but Omitted**: `artistry`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (parallel with T22 after T19)
  - **Blocks**: T23, F1-F4
  - **Blocked By**: T14, T19

  **References**:
  - `docss/react-native-rebuild-spec.md` - KPI and performance targets.
  - `docss/react-native-weekly-ticket-plan.md` - `MOB-034`, `MOB-035`.
  - `docss/react-native-mvp-checklist.md` - release monitoring gate.

  **Acceptance Criteria**:
- [ ] Crash and error events visible in monitoring dashboard.
- [ ] Baseline metrics captured for startup and upload latencies.
- [ ] Health telemetry KPIs visible with daily trend and alert thresholds.

  **QA Scenarios**:
  ```text
  Scenario: Metrics pipeline active (happy)
    Tool: Bash
    Preconditions: telemetry keys configured in staging
    Steps:
      1. Generate controlled app events (startup, upload, handled error)
      2. Query telemetry backend for those event IDs
      3. Assert all events received within SLA window
    Expected Result: full telemetry ingestion
    Failure Indicators: event loss or delayed beyond threshold
    Evidence: .sisyphus/evidence/task-21-observability.json

  Scenario: Crash capture disabled (failure)
    Tool: Bash
    Preconditions: staging build with crash test hook
    Steps:
      1. Trigger synthetic non-fatal and fatal crash events
      2. Assert alerts and captured stack traces exist
    Expected Result: monitoring alerts fire correctly
    Evidence: .sisyphus/evidence/task-21-observability-error.json
  ```

  **Commit**: YES
  - Message: `chore(observability): add mobile telemetry and perf checks`

- [ ] 22. Subscription Status + Web Checkout Fallback Compliance

  **What to do**:
  - Implement subscription status display in mobile app.
  - Keep payment execution fallback to web checkout for MVP.
  - Document app store policy notes and user messaging for fallback.

  **Must NOT do**:
  - Attempt full in-app purchase redesign in MVP scope.

  **Recommended Agent Profile**:
  - **Category**: `deep` - policy-sensitive product flow.
  - **Skills**: `payments`, `security`
  - **Skills Evaluated but Omitted**: `visual-engineering`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (parallel with T21)
  - **Blocks**: T23, F1-F4
  - **Blocked By**: T18, T19

  **References**:
  - `docss/react-native-rebuild-spec.md` - subscription MVP-late fallback recommendation.
  - `docss/react-native-weekly-ticket-plan.md` - release-stage subscription dependencies.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/api/subscription/route.ts` - current subscription contract.

  **Acceptance Criteria**:
  - [ ] Active/inactive subscription status is accurate in mobile UI.
  - [ ] Web checkout fallback launches reliably with tracked return path.

  **QA Scenarios**:
  ```text
  Scenario: Status display + fallback navigation (happy)
    Tool: Maestro
    Preconditions: one subscribed user, one non-subscribed user
    Steps:
      1. Open billing/settings screen for both accounts
      2. Assert status badge correctness
      3. Trigger upgrade for non-subscribed user and assert web checkout opens
    Expected Result: accurate status and fallback link behavior
    Failure Indicators: wrong status or broken checkout redirect
    Evidence: .sisyphus/evidence/task-22-subscription-fallback.json

  Scenario: Checkout return path failure (failure)
    Tool: Maestro
    Preconditions: simulate canceled checkout return
    Steps:
      1. Launch checkout and cancel externally
      2. Return to app and assert stable state with retry CTA
    Expected Result: no stuck loading or inconsistent status
    Evidence: .sisyphus/evidence/task-22-subscription-fallback-error.json
  ```

  **Commit**: YES
  - Message: `feat(subscription): add status and web-checkout fallback`

- [ ] 23. Beta/Release Readiness Package (EAS + Runbook + Go/No-Go)

  **What to do**:
  - Produce internal beta releases (TestFlight/Internal Track) with signed builds.
  - Create release runbook, rollback procedure, and go/no-go checklist.
  - Include health-feature go/no-go branch (enable vs feature-flag-off fallback).
  - Execute final gate review with P0/P1 defects at zero.

  **Must NOT do**:
  - Ship GA without verified rollback path and on-call owner.

  **Recommended Agent Profile**:
  - **Category**: `deep` - release governance.
  - **Skills**: `eas`, `release-management`
  - **Skills Evaluated but Omitted**: `ui-ux-pro-max`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final task of Wave 5
  - **Blocks**: F1-F4
  - **Blocked By**: T6, T19-T22, T28-T30

  **References**:
  - `docss/react-native-weekly-ticket-plan.md` - Week 8 release tasks and exit conditions.
  - `docss/react-native-mvp-checklist.md` - release gate requirements.
  - `docss/react-native-rebuild-spec.md` - launch/rollback and KPI operations guidance.

  **Acceptance Criteria**:
  - [ ] Internal beta build distributed to both platforms.
  - [ ] Release runbook includes rollback trigger conditions and command paths.
  - [ ] Go/no-go checklist signed with all gates green.

  **QA Scenarios**:
  ```text
  Scenario: Beta distribution ready (happy)
    Tool: Bash
    Preconditions: EAS credentials configured
    Steps:
      1. Build and submit iOS internal beta
      2. Build and submit Android internal track
      3. Assert artifacts and tester access links generated
    Expected Result: both internal channels available
    Failure Indicators: missing artifact or submission rejection
    Evidence: .sisyphus/evidence/task-23-release-beta.json

  Scenario: Rollback rehearsal (failure)
    Tool: Bash
    Preconditions: runbook drafted
    Steps:
      1. Execute rollback drill using documented procedure
      2. Assert previous stable build reactivation succeeds
    Expected Result: rollback executable within target time
    Evidence: .sisyphus/evidence/task-23-release-beta-error.json
  ```

  **Commit**: YES
  - Message: `chore(release): finalize beta, rollback, and go-no-go`

- [ ] 24. Health Integration Contract and Data Model Design

  **What to do**:
  - Promote health integration into release-critical scope (read-only `steps` + `active_kcal`).
  - Publish the canonical contracts for `health_daily_metrics` and `health_sync_state` with fields, indexes, constraints, and migration intent.
  - Add feature-flag controls for per-platform rollout (`health:ios`, `health:android`, `health:enabled`).
  - Define bounded initial backfill policy: 30-day max on first run, then cursor-based incremental sync.
  - Set sync strategy defaults for iOS (`HKAnchoredObjectQuery` cursor) and Android (`HealthConnect getChanges` token).

  **Must NOT do**:
  - Implement write-back to HealthKit/Health Connect in MVP.
  - Persist raw event samples in MVP (aggregate-only tables).

  **Recommended Agent Profile**:
  - **Category**: `deep` - cross-platform contract and risk control.
  - **Skills**: `typescript`, `supabase`
  - **Skills Evaluated but Omitted**: `visual-engineering`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 start
  - **Blocks**: T25-T28, T30
  - **Blocked By**: T4, T5, T7

  **References**:
  - `docss/react-native-rebuild-spec.md` - existing Post-MVP health note and architecture baseline.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/dashboard.actions.ts` - target aggregation insertion point.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/types/database.types.ts` - authoritative type source.
  - `.sisyphus/evidence/task-1-preflight-contracts.md` - health rollout contract defaults.
  - `https://developer.android.com/health-and-fitness/health-connect` - Android provider model.
  - `https://developer.apple.com/documentation/healthkit` - iOS data source baseline.

  **Acceptance Criteria**:
  - [ ] `health_daily_metrics` contract captured with required fields: `user_id`, `platform`, `local_date`, `steps`, `active_kcal`, `source`, `data_point_count`, `tz_offset_min`, `synced_at`, `first_seen_at`, `last_seen_at`.
  - [ ] `health_daily_metrics` includes deterministic uniqueness (`user_id`, `platform`, `local_date`, `source`) and retention/deletion rules.
  - [ ] `health_sync_state` contract captured with required fields: `user_id`, `platform`, `record_type`, `anchor_or_token`, `cursor_state`, `last_success_at`, `last_error_at`, `error_message`, `cursor_version`, `is_running`.
  - [ ] Feature flags and rollback path documented: `health:enabled`, `health:ios`, `health:android`.
  - [ ] Scope guardrails explicitly state read-only, aggregate-only, and Samsung via Health Connect only.

  **QA Scenarios**:
  ```text
  Scenario: Contract completeness (happy)
    Tool: Bash
    Preconditions: plan updated
    Steps:
      1. Search plan for `health_daily_metrics` and `health_sync_state` definitions
      2. Assert all required fields in both tables exist
      3. Assert feature flags and backfill policy are recorded
    Expected Result: health contracts are executable and bounded
    Failure Indicators: missing table fields, missing rollout controls, or missing backfill rules
    Evidence: .sisyphus/evidence/task-24-health-contract.txt

  Scenario: Scope creep detector (failure)
    Tool: Bash
    Preconditions: same
    Steps:
      1. Search for "write-back" or "raw samples" under T24-MVP scope section
      2. Confirm only read/aggregate implementation language exists
    Expected Result: strict scope enforcement
    Evidence: .sisyphus/evidence/task-24-health-contract-error.txt
  ```

  **Commit**: YES
  - Message: `chore(health): define health data contract and scope`

- [ ] 25. iOS HealthKit Capability and Permission Flow

  **What to do**:
  - Add entitlement and privacy `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription` requirements for read-only `steps` and `activeEnergyBurned`.
  - Implement permission status lifecycle checks for `notDetermined`, `denied`, `revoked`, `granted`, with non-blocking recovery UI.
  - Add in-app rationale before prompt and settings deep-link recovery flow for denied/revoked states.
  - Add startup guard so HealthKit sync never blocks onboarding, auth restore, or dashboard first render.

  **Must NOT do**:
  - Request broad HealthKit scopes beyond required read types.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - native capability and auth UX reliability.
  - **Skills**: `expo`, `security`
  - **Skills Evaluated but Omitted**: `quick`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T26 prep)
  - **Blocks**: T26, T29, T30
  - **Blocked By**: T24

  **References**:
  - `https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data` - authorization behavior.
  - `https://docs.expo.dev/workflow/customizing/` - native module path in Expo workflow.
  - `https://docs.expo.dev/develop/development-builds/introduction/` - dev build requirement.
  - `https://developer.apple.com/app-store/app-privacy-details/` - privacy disclosure linkage.

  **Acceptance Criteria**:
  - [ ] Permission flow captures grant/deny/revoke and updates `health_sync_state` status transitions.
  - [ ] Non-blocking fallback text appears for denied/revoked users within same render session.
  - [ ] Entitlement and usage-description checklist exists in release prerequisites.
  - [ ] HealthKit connect flow does not alter startup budget or block auth bootstrap.

  **QA Scenarios**:
  ```text
  Scenario: Permission granted path (happy)
    Tool: Maestro
    Preconditions: iOS dev build with HealthKit capability
    Steps:
      1. Open health connect screen and tap connect
      2. Grant requested HealthKit read permissions
      3. Assert sync status becomes connected and last-sync timestamp appears
    Expected Result: iOS health permission and connection succeed
    Failure Indicators: permission granted but disconnected state persists
    Evidence: .sisyphus/evidence/task-25-healthkit-permission.json

  Scenario: Permission denied/revoked (failure)
    Tool: Maestro
    Preconditions: permission denied or revoked in iOS settings
    Steps:
      1. Open health section with denied state
      2. Assert fallback state plus settings CTA is visible
      3. Return without granting and verify core app remains usable
    Expected Result: graceful degraded mode without crash
    Evidence: .sisyphus/evidence/task-25-healthkit-permission-error.json
  ```

  **Commit**: YES
  - Message: `feat(health-ios): add healthkit permission and fallback flow`

- [ ] 26. Android Health Connect Provider Integration

  **What to do**:
  - Define Android Health Connect permission matrix for `steps` and `activeCaloriesBurned`.
  - Add provider availability checks and install/update guidance when Health Connect is missing or outdated.
  - Add read error handling for provider-disabled and token-expiry states before showing sync controls.
  - Ensure permission and availability checks are resilient across Android versions and do not block core app navigation.

  **Must NOT do**:
  - Assume Health Connect exists on every Android device/version.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` - platform compatibility and reliability.
  - **Skills**: `android`, `security`
  - **Skills Evaluated but Omitted**: `visual-engineering`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 sequential
  - **Blocks**: T27, T28, T29, T30
  - **Blocked By**: T24, T25, T11

  **References**:
  - `https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started` - integration baseline.
  - `https://developer.android.com/health-and-fitness/guides/health-connect/ui/permissions` - permission UX guidance.
  - `https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data` - read APIs and constraints.
  - `https://support.google.com/googleplay/android-developer/answer/12991134?hl=en` - health permissions policy context.
  - `.sisyphus/evidence/task-1-preflight-contracts.md` - provider behavior and fallback defaults.

  **Acceptance Criteria**:
  - [ ] `providerAvailable`, `providerVersion`, `requestPermission`, and `installProvider` branches are documented and covered by QA.
  - [ ] Availability/unavailability branch paths show clear messaging and non-blocking core UX fallback.
  - [ ] Android permission matrix includes only required read scopes.

  **QA Scenarios**:
  ```text
  Scenario: Health Connect available path (happy)
    Tool: Maestro
    Preconditions: Android device with Health Connect available and connected source app
    Steps:
      1. Start health setup and grant read permissions
      2. Run first sync
      3. Assert daily steps and active_kcal values appear in app
    Expected Result: Android sync succeeds through Health Connect
    Failure Indicators: connected state but empty data with no explanation
    Evidence: .sisyphus/evidence/task-26-healthconnect-available.json

  Scenario: Provider unavailable path (failure)
    Tool: Maestro
    Preconditions: device without Health Connect support/installation
    Steps:
      1. Open health section
      2. Assert unavailable message and guidance CTA
      3. Verify app continues with manual mode fallback
    Expected Result: safe fallback without blocking core app
    Evidence: .sisyphus/evidence/task-26-healthconnect-available-error.json
  ```

  **Commit**: YES
  - Message: `feat(health-android): add health connect integration flow`

- [x] 27. Deferred Sync Engine and Data Integrity (Cursor + Idempotency)

  **What to do**:
  - Implement sync orchestration that runs only after initial app render and auth/session bootstrap settle.
  - Add background-safe sync queue with overlap prevention (`isRunning` + last-start timestamp guard).
  - Persist iOS anchor or Android token only after fully successful page-level read/aggregate/write commit.
  - Build idempotent upsert by `(user_id, local_date, platform, source)` with deterministic recompute on rerun.
  - Normalize ingestion timestamps with stored `tz_offset_min`; split records crossing midnight to avoid day-boundary misattribution.

  **Must NOT do**:
  - Trigger health sync on startup critical path.
  - Double-count overlapping sync windows.

  **Recommended Agent Profile**:
  - **Category**: `deep` - data correctness and performance coupling.
  - **Skills**: `supabase`, `tanstack-query`
  - **Skills Evaluated but Omitted**: `artistry`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 sequential
  - **Blocks**: T20, T29
  - **Blocked By**: T26, T14

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/dashboard.actions.ts` - cache and aggregation pattern.
  - `docss/react-native-rebuild-spec.md` - performance targets and cache principles.
  - `.sisyphus/evidence/task-1-preflight-contracts.md` - sync and failure model baseline.
  - `https://developer.apple.com/documentation/healthkit` - anchor-based sync concepts.
  - `https://developer.android.com/health-and-fitness/health-connect` - change/read model.

  **Acceptance Criteria**:
  - [ ] Running sync twice on same window does not create duplicate daily aggregates.
  - [ ] Cold-start path remains within baseline budget while sync is enabled but deferred.
  - [ ] `changesTokenExpired`/anchor-missing is handled by reset + bounded bootstrap plan.
  - [ ] Duplicate writes are prevented by unique constraints and idempotent SQL.

  **QA Scenarios**:
  ```text
  Scenario: Idempotent sync rerun (happy)
    Tool: Bash
    Preconditions: seeded health data for fixed date range
    Steps:
      1. Execute sync command for range A
      2. Execute sync command for same range A again
      3. Query daily aggregate rows and assert no duplicates per user/date/source
    Expected Result: deterministic idempotent result
    Failure Indicators: row count increases on second run without source changes
    Evidence: .sisyphus/evidence/task-27-sync-idempotency.json

  Scenario: Startup path regression (failure)
    Tool: Maestro
    Preconditions: health sync enabled with large backfill pending
    Steps:
      1. Launch app from cold start
      2. Measure time to dashboard first meaningful render
      3. Assert health sync starts after render and does not block UI
    Expected Result: first render unaffected by sync workload
    Evidence: .sisyphus/evidence/task-27-sync-idempotency-error.json
  ```

  **Commit**: YES
  - Message: `feat(health-sync): add deferred cursor-based sync engine`

- [x] 28. Health Metrics UX Integration (Dashboard + Report)

  **What to do**:
  - Add steps and active-calorie cards to dashboard with stale/error states and reconnect CTA.
  - Extend weekly report summaries to include health section when `health_daily_metrics` rows exist.
  - Keep manual entry and core nutrition/mood paths independent if permission or provider sync is unavailable.
  - Add timezone-aware last-sync banner and stale-data indicators based on `last_success_at` drift.

  **Must NOT do**:
  - Break existing dashboard/report render when health data is absent.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` - mixed data visualization and resilience UX.
  - **Skills**: `ui-ux-pro-max`, `tanstack-query`
  - **Skills Evaluated but Omitted**: `quick`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 completion task
  - **Blocks**: T20, T23, F1-F4
  - **Blocked By**: T26, T27

  **References**:
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/app/(protected)/dashboard/page.tsx` - current dashboard composition.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/dashboard.actions.ts` - dashboard data shape source.
  - `/Users/javadreamer/Develop/Nextjs/diet-hub/src/lib/actions/report.actions.ts` - weekly report insertion point.
  - `.sisyphus/evidence/task-1-preflight-contracts.md` - fallback state requirements.

  **Acceptance Criteria**:
  - [ ] Dashboard renders health cards when data exists and deterministic fallback cards when unavailable.
  - [ ] Weekly report includes health summary block without impacting nutrition/mood sections.
  - [ ] Stale/disabled state banner appears when `last_success_at` exceeds configured stale threshold.
  - [ ] Permission/revoked fallback remains usable with one-tap reconnect path.

  **QA Scenarios**:
  ```text
  Scenario: Health cards visible with data (happy)
    Tool: Maestro
    Preconditions: synced daily health aggregates present
    Steps:
      1. Open dashboard
      2. Assert steps and active-kcal cards display expected values
      3. Open weekly report and assert health summary section appears
    Expected Result: health metrics integrated into both surfaces
    Failure Indicators: report/dashboard crash when health fields missing
    Evidence: .sisyphus/evidence/task-28-health-ui.json

  Scenario: Stale/no-permission fallback (failure)
    Tool: Maestro
    Preconditions: revoke health permission after initial sync
    Steps:
      1. Reopen dashboard
      2. Assert stale badge and reconnect CTA appear
      3. Verify nutrition/report core sections remain functional
    Expected Result: graceful degradation without blocking core loop
    Evidence: .sisyphus/evidence/task-28-health-ui-error.json
  ```

  **Commit**: YES
  - Message: `feat(health-ui): integrate health metrics in dashboard/report`

- [x] 29. Health Compliance and Privacy Artifact Package

  **What to do**:
  - Prepare App Store App Privacy and Google Play Data Safety matrix for health metrics and sync metadata.
  - Document collection purpose, retention, deletion, sharing restrictions, and prohibition on ad-targeting/profiling/sale.
  - Add consent/permission language aligned to read-only aggregate data flow and provider-specific scope.

  **Must NOT do**:
  - Ship without privacy policy updates aligned to health data processing.

  **Recommended Agent Profile**:
  - **Category**: `writing` - policy and compliance artifact precision.
  - **Skills**: `security`, `release-management`
  - **Skills Evaluated but Omitted**: `visual-engineering`.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (after T19 and T27; parallel with T21,T22)
  - **Blocks**: T23, T30, F1-F4
  - **Blocked By**: T19, T25, T26, T27

  **References**:
  - `https://developer.apple.com/app-store/app-privacy-details/` - App Store privacy disclosure requirements.
  - `https://developer.apple.com/app-store/review/guidelines/` - Apple review constraints.
  - `https://support.google.com/googleplay/android-developer/answer/10787469?hl=en` - Play Data Safety.
  - `https://support.google.com/googleplay/android-developer/answer/12991134?hl=en` - sensitive health permission policy context.
  - `.sisyphus/evidence/task-5-env-profiles.md` - compliance and secret-handling baseline.

  **Acceptance Criteria**:
  - [ ] Compliance package includes Apple and Google sections with explicit source ownership and review status.
  - [ ] Privacy policy delta states health data use is feature-only with delete path and zero-ad/profiling terms.
  - [ ] No statement in artifacts allows sharing/retargeting or sale of health aggregates.

  **QA Scenarios**:
  ```text
  Scenario: Compliance artifact completeness (happy)
    Tool: Bash
    Preconditions: compliance docs generated
    Steps:
      1. Validate artifact includes Apple privacy, Play data safety, permission rationale, deletion policy
      2. Assert every row has owner and status
    Expected Result: complete auditable compliance package
    Failure Indicators: missing platform section or unowned items
    Evidence: .sisyphus/evidence/task-29-compliance-package.txt

  Scenario: Forbidden use-case leak (failure)
    Tool: Bash
    Preconditions: policy text finalized
    Steps:
      1. Search policy artifacts for ad-targeting/profiling allowances tied to health metrics
      2. Assert no permissive language exists
    Expected Result: prohibited usage fully blocked in policy
    Evidence: .sisyphus/evidence/task-29-compliance-package-error.txt
  ```

  **Commit**: YES
  - Message: `docs(compliance): add health data privacy and policy package`

- [x] 30. Health Go/No-Go Gate and Rollback Controls

  **What to do**:
  - Publish release gates with concrete thresholds and owner sign-off.
  - Add feature flags/kill switch scoped to health module: `health:enabled`, `health:ios`, `health:android`.
  - Define rollback playbook that disables health feature with no impact to authentication and baseline nutrition/mood flows.
  - Add no-go criteria for startup regression, data quality, and permission UX failure.

  **Must NOT do**:
  - Block full app release when health feature can be safely feature-flagged off.

  **Recommended Agent Profile**:
  - **Category**: `deep` - release governance and risk containment.
  - **Skills**: `release-management`, `analytics`
  - **Skills Evaluated but Omitted**: `artistry`.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 closing task
  - **Blocks**: T23, F1-F4
  - **Blocked By**: T22, T25, T26, T29

  **References**:
  - `docss/react-native-weekly-ticket-plan.md` - release prep framework.
  - `docss/react-native-mvp-checklist.md` - release gate baseline.
  - `docss/react-native-rebuild-spec.md` - KPI/ops/performance targets.
  - `.sisyphus/evidence/task-6-ci-baseline.md` - gate execution and artifact strategy.

  **Acceptance Criteria**:
  - [ ] Health gate thresholds are explicit and published in evidence artifacts:
    - Sync success rate >= `95%` over the last 7 days.
    - Duplicate rows in `health_daily_metrics` per `(user_id, local_date, platform, source)` = `0`.
    - Stale ratio (`now - last_success_at`) <= `72 hours` for active users; stale banner appears within `5` minutes of threshold breach detection.
    - Health module crash-free rate >= `99.9%` over 7 days.
    - Health startup impact (time to dashboard first meaningful render) <= `2200ms p95` with sync enabled but deferred.
  - [ ] No-go trigger is documented for any threshold miss and includes owner decision log.
  - [ ] Health rollback path tested and shown to restore non-health app flows in <= `10` minutes.

  **QA Scenarios**:
  ```text
  Scenario: Health release gates pass (happy)
    Tool: Bash
    Preconditions: beta telemetry data collected for 7-day window
    Steps:
      1. Evaluate health gate metrics against thresholds
      2. Assert all gates PASS and go/no-go record signed
    Expected Result: health feature eligible for GA enablement
    Failure Indicators: one or more threshold fails without action plan
    Evidence: .sisyphus/evidence/task-30-health-go-no-go.json

  Scenario: Gate fail with controlled fallback (failure)
    Tool: Bash
    Preconditions: simulate failing sync success threshold
    Steps:
      1. Trigger no-go decision flow
      2. Disable health feature flags and execute rollback checklist
      3. Assert core app release remains valid
    Expected Result: health module isolated without blocking core GA
    Evidence: .sisyphus/evidence/task-30-health-go-no-go-error.json
  ```

  **Commit**: YES
  - Message: `chore(release): add health-specific go-no-go controls`

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** - `oracle`
  - Validate each Must Have and Must NOT Have against implementation artifacts and evidence files.
  - Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`.

- [ ] F2. **Code Quality Review** - `unspecified-high`
  - Run lint/type/test commands; inspect for `any`, `ts-ignore`, dead code, and generic naming slop.
  - Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N/N] | VERDICT`.

- [ ] F3. **Real QA Replay** - `unspecified-high`
  - Replay all QA scenarios from T1-T30 on clean environment and verify evidence completeness.
  - Output: `Scenarios [N/N] | Integration [N/N] | Edge [N tested] | VERDICT`.

- [ ] F4. **Scope Fidelity Check** - `deep`
  - Compare completed work to task scopes; detect overbuild, missing items, or cross-task contamination.
  - Output: `Tasks [N/N compliant] | Contamination [CLEAN/issues] | VERDICT`.

---

## Commit Strategy

- **C1 (Preflight)**: `chore(mobile-migration): lock contracts and migration matrix` - T1-T3
- **C2 (Foundation)**: `feat(mobile-foundation): bootstrap expo app and infra` - T4-T7
- **C3 (Core Flows)**: `feat(mobile-core): implement auth onboarding and record pipeline` - T8-T13
- **C4 (Feature Completion)**: `feat(mobile-mvp): deliver dashboard goals mood profile report` - T14-T18
- **C5 (Health Priority)**: `feat(health): integrate health data pipeline and UI` - T24-T28
- **C6 (Hardening/Release)**: `chore(mobile-release): add qa gates and release readiness` - T19-T23, T29-T30

---

## Success Criteria

### Verification Commands
```bash
npm run lint && npm run test:run && npm run build
# Expected: all pass on mobile workspace and required backend contracts

npm --prefix apps/mobile ls expo react-native react @supabase/supabase-js @tanstack/react-query zustand zod react-hook-form
# Expected: matches Version Baseline major/minor bands

npm run release:gates:health
# Expected: HEALTH_GATES=PASS or HEALTH_GATES=NO_GO with feature-flag fallback activated
```

### Final Checklist
- [ ] All Must Have items implemented
- [ ] All Must NOT Have constraints respected
- [ ] Preflight blockers fully closed with evidence
- [ ] Core E2E flows pass on iOS and Android
- [ ] Health integration gates pass (permission/revocation/idempotency/performance/compliance)
- [ ] Version Baseline lock verified and drift check passes
- [ ] Release gate criteria met with rollback/runbook complete
