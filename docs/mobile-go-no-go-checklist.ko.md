# 모바일 Go/No-Go 체크리스트 (T23/T30)

날짜: 2026-02-23

## 릴리스 게이트 체크리스트

- [ ] iOS 내부 베타(TestFlight) 빌드 + 제출 완료
- [ ] Android 내부 트랙 빌드 + 제출 완료
- [ ] 내부 테스터 접근 링크 확인 완료
- [ ] `npm run typecheck --workspace apps/mobile` 통과
- [ ] `npm run lint --workspace apps/mobile` 통과
- [ ] `npm run test:run --workspace apps/mobile` 통과
- [ ] `npm run build --workspace apps/mobile` 통과
- [ ] P0/P1 결함 0건 확인
- [ ] 롤백 드릴 실행 또는 직전 검증 로그 확인

## 헬스 기능 브랜치 의사결정

- [ ] `npm run release:gates:health` 결과가 `PASS`인 경우:
  - [ ] health 기능 `enabled` 경로로 배포 승인
- [ ] `npm run release:gates:health` 결과가 `NO_GO`인 경우:
  - [ ] `health:enabled=false`, `health:ios=false`, `health:android=false` 폴백 기록
  - [ ] 코어 기능(auth/record/dashboard/report) 정상 동작 재검증

## 헬스 게이트 임계치 (T30)

모드: 시뮬레이션 dry-run 증적(런타임 텔레메트리 수집은 이후 진행)

| Gate | Threshold | Latest measured | Result |
|------|-----------|-----------------|--------|
| sync_success_rate_7d | >= 95% | 98.4 | PASS |
| duplicate_rows | = 0 | 0 | PASS |
| stale_ratio_hours | <= 72 | 18.6 | PASS |
| stale_banner_sla_minutes | <= 5 | 2.7 | PASS |
| crash_free_7d | >= 99.9% | 99.96 | PASS |
| startup_tti_p95_ms | <= 2200 | 1840 | PASS |

## No-go 폴백 리허설 (T30)

- [x] 임계치 미달 상황 제어 시뮬레이션(`sync_success_rate_7d=91.2`) -> `NO_GO`
- [x] 킬스위치 폴백 적용(`health:enabled`, `health:ios`, `health:android` 비활성)
- [x] 코어 라우트 커버리지 확인(dashboard/report/nutrition/mood/auth)
- [x] 롤백 완료 시간 10분 이내 확인(실측 6분)

## 서명

| Role | Name | Decision | Timestamp | Notes |
|------|------|----------|-----------|-------|
| Release owner | | GO / NO_GO | | |
| On-call owner | | GO / NO_GO | | |
| QA owner | | GO / NO_GO | | |
