# 모바일 릴리스 런북 (T23/T30)

날짜: 2026-02-23

## 범위

- 내부 베타 릴리스 전용(TestFlight + Google Play Internal Track)
- GA(일반 배포) 승격은 이 런북 범위에 포함하지 않음

## 사전 조건

- 양 플랫폼(iOS/Android) EAS 자격 증명 설정 완료
- App Store Connect 앱, Google Play Console 앱 생성 완료
- `apps/mobile/app.json`의 번들/패키지 식별자 확정
- Health entitlement/privacy 체크리스트 확인:
  - Steps/Active Calories 읽기 전용 범위에 대한 `NSHealthShareUsageDescription` 설정
  - MVP no-write 정책 반영 `NSHealthUpdateUsageDescription` 설정
  - dev/release 빌드용 iOS 타겟 HealthKit Capability 활성화(Xcode)
- `apps/mobile/eas.json`의 preview/production 프로필 사용 가능

## 실행 명령 경로

1. iOS 베타 빌드:
   - `npx eas build --platform ios --profile preview --non-interactive`
2. Android 베타 빌드:
   - `npx eas build --platform android --profile preview --non-interactive`
3. iOS TestFlight 제출:
   - `npx eas submit --platform ios --profile preview --latest --non-interactive`
4. Android Internal Track 제출:
   - `npx eas submit --platform android --profile preview --latest --non-interactive`
5. 사인오프 전 품질 게이트:
   - `npm run typecheck --workspace apps/mobile`
   - `npm run lint --workspace apps/mobile`
   - `npm run test:run --workspace apps/mobile`
   - `npm run build --workspace apps/mobile`
6. 헬스 브랜치 게이트:
   - `npm run release:gates:health`

## 롤백 트리거 조건

- P0/P1 결함이 하나라도 열려 있음
- 어느 한 플랫폼이라도 베타 빌드 제출 실패
- 내부 테스터 접근 경로 손상
- Health 게이트 결과가 `NO_GO`인데 폴백 결정이 문서화되지 않음

## 헬스 게이트 임계치 (T30)

- sync_success_rate_7d >= 95%
- duplicate_rows = 0
- stale_ratio_hours <= 72
- stale_banner_sla_minutes <= 5
- crash_free_7d >= 99.9%
- startup_tti_p95_ms <= 2200

임계치 하나라도 실패하면 no-go 폴백을 실행하고, health 플래그를 끈 상태로 코어 릴리스 경로를 계속 진행합니다.

## 롤백 절차

1. 롤아웃 승격 즉시 중단(내부 베타를 넘겨 승격하지 않음)
2. health 폴백 킬스위치 적용:
   - `health:enabled = false`
   - `health:ios = false`
   - `health:android = false`
3. 폴백 모드에서 코어 플로우 재검증:
   - auth, dashboard, record, mood, report
4. 내부 테스터에 직전 안정(stable) 빌드 재배포:
   - TestFlight/Internal Track에서 이전 stable 빌드 활성화
5. go/no-go 체크리스트에 책임자 결정 + 시각 + 조치 내역 기록

## 담당자

- Release owner: `<name>`
- On-call owner: `<name>`
- QA owner: `<name>`

## 산출물

- `.sisyphus/evidence/task-23-release-beta.json`
- `.sisyphus/evidence/task-23-release-beta-error.json`
- `.sisyphus/evidence/task-30-health-go-no-go.json`
- `.sisyphus/evidence/task-30-health-go-no-go-error.json`
