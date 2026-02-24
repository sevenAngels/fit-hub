# Mobile Go/No-Go Checklist (T23/T30)

Date: 2026-02-23

## Release gate checklist

- [ ] iOS internal beta(TestFlight) build + submit 완료
- [ ] Android internal track build + submit 완료
- [ ] 내부 테스터 접근 링크 확인 완료
- [ ] `npm run typecheck --workspace apps/mobile` 통과
- [ ] `npm run lint --workspace apps/mobile` 통과
- [ ] `npm run test:run --workspace apps/mobile` 통과
- [ ] `npm run build --workspace apps/mobile` 통과
- [ ] P0/P1 결함 0건 확인
- [ ] 롤백 드릴 실행 또는 직전 검증 로그 확인

## Health feature branch decision

- [ ] `npm run release:gates:health` 결과가 `PASS`인 경우:
  - [ ] health 기능 `enabled` 경로로 배포 승인
- [ ] `npm run release:gates:health` 결과가 `NO_GO`인 경우:
  - [ ] `health:enabled=false`, `health:ios=false`, `health:android=false` fallback 기록
  - [ ] 코어 기능(auth/record/dashboard/report) 정상 여부 재검증

## Health gate thresholds (T30)

Mode: simulated dry-run evidence (runtime telemetry capture deferred).

| Gate | Threshold | Latest measured | Result |
|------|-----------|-----------------|--------|
| sync_success_rate_7d | >= 95% | 98.4 | PASS |
| duplicate_rows | = 0 | 0 | PASS |
| stale_ratio_hours | <= 72 | 18.6 | PASS |
| stale_banner_sla_minutes | <= 5 | 2.7 | PASS |
| crash_free_7d | >= 99.9% | 99.96 | PASS |
| startup_tti_p95_ms | <= 2200 | 1840 | PASS |

## No-go fallback rehearsal (T30)

- [x] Controlled threshold miss simulated (`sync_success_rate_7d=91.2`) -> `NO_GO`
- [x] Kill-switch fallback applied (`health:enabled`, `health:ios`, `health:android` off)
- [x] Core route coverage verified (dashboard/report/nutrition/mood/auth)
- [x] Rollback completion <= 10 minutes (observed 6 minutes)

## Sign-off

| Role | Name | Decision | Timestamp | Notes |
|------|------|----------|-----------|-------|
| Release owner | | GO / NO_GO | | |
| On-call owner | | GO / NO_GO | | |
| QA owner | | GO / NO_GO | | |
