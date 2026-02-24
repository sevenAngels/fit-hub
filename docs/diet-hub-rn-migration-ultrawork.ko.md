# Diet Hub PWA -> React Native 마이그레이션 (Ultrawork 계획서 번역본)

원문: `docs/diet-hub-rn-migration-ultrawork.md`
날짜: 2026-02-23

## TL;DR

> **요약**: Next.js PWA 기반 Diet Hub를 Expo 기반 React Native 앱으로 재구축합니다. 백엔드(Supabase)는 재사용하고, 헬스 연동(Apple HealthKit / Android Health Connect: 걸음수, 활동 칼로리)을 핵심 목표로 우선 포함합니다.
>
> **핵심 산출물**:
> - React Native 앱 스켈레톤 + 인증 기반 MVP 핵심 흐름(Auth, Onboarding, Record, Dashboard, Goals/Habits, Mood, Profile, Weekly Report)
> - 헬스 연동 MVP+ 범위: 일일 걸음/활동 칼로리 동기화 + 권한 거부/철회 안전 UX
> - 사전 의사결정 산출물(auth transport, deep link, report 의존성 맵, 타입 계약 드리프트 수정)
> - 자동 품질 게이트(unit/integration/E2E, RLS/storage smoke, release checklist)
>
> **예상 공수**: 대규모(엄격 MVP 8주, 안정화 버퍼 포함 7~10주)
> **병렬 실행**: 가능(4개 Wave + 최종 검증 Wave)
> **크리티컬 패스**: T1 -> T3 -> T7 -> T9 -> T12 -> T24 -> T26 -> T28 -> T20 -> T23

## 현재 진행 스냅샷 (2026-02-23)

- 완료: Wave 1(T1-T6), Wave 2(T7-T12), T13~T30 구현 패치
- 현재 상태: Wave 4(health integration) 검증/정리 단계
- 다음 실행 타깃: F1
- 최근 evidence 요약: `.sisyphus/evidence/task-30-health-go-no-go.md`
- 재시작 기준 파일:
  - 계획서: `docs/diet-hub-rn-migration-ultrawork.md`
  - 상태 포인터: `.sisyphus/boulder.json`
  - 첫 다음 작업: `F1. Plan Compliance Audit`

## AI 재시작 가이드

- **어디까지 완료?** T1~T12 체크 완료, T13~T30은 구현 패치 상태(실디바이스 QA 증적 일부 대기)
- **체크 상태 핵심**: T1~T12 `[x]`, T13~T26 `[ ]`, T27~T30 `[x]`, F1~F4 `[ ]`
- **다음 시작 작업**: `F1. Plan Compliance Audit`
- **기능 구현 재개 기준점**: 감사(F1)가 아니라 기능 개발을 재개할 경우 `T13`부터 순차 진행
- **우선 확인 파일**:
  - `.sisyphus/evidence/*`
  - `docs/diet-hub-rn-migration-ultrawork.md`
  - `docs/mobile-device-testing-guide.md`
  - `docs/mobile-go-no-go-checklist.md`
  - `docs/mobile-release-runbook.md`
- **작업 후 필수 검증 명령**:
  - `npm run typecheck --workspace apps/mobile`
  - `npm run lint --workspace apps/mobile`
  - `npm run test:run --workspace apps/mobile`
  - `npm run build --workspace apps/mobile`

## 컨텍스트

### 원요청
- `docs/`의 기획 문서 3개를 분석하고, 형제 프로젝트 `diet-hub` 코드베이스를 참조해 RN 전환 ultrawork 계획을 수립.

### 핵심 의사결정
- RN(Expo)로 전환, MVP 우선.
- DB/백엔드는 Supabase 재사용.
- Server Actions 직접 재사용 금지, 모바일 친화 구조로 치환.
- 헬스 연동(걸음/활동칼로리)을 Post-MVP가 아니라 릴리스 범위로 승격.

### 사전 리스크 정리
- 인증 전송방식 모호성 -> preflight gate로 고정
- deep link/reset 경로 mismatch -> 전용 계약 태스크로 분리
- 타입/스키마 drift -> 단일 타입 소스로 정리
- Server Action 숨은 결합 -> replacement matrix로 가시화
- 헬스 우선순위 누락 -> T24~T30 health wave 신설

## 작업 목표

### 핵심 목표
- Diet Hub의 핵심 동작을 유지한 프로덕션 수준 RN MVP를 완성하고, 헬스 데이터 연동(걸음/활동칼로리)을 성능/컴플라이언스 게이트와 함께 안전하게 제공.

### 완료 정의(DoD)
- `.sisyphus/evidence/` 기준으로 preflight blocker 해소 증적 존재
- iOS/Android MVP 시나리오 통과
- 릴리스 게이트 통과 + P0/P1 결함 0

### Must Have
- Supabase RLS/storage 모델 재사용
- 모바일 안전 auth/session 전략
- MVP 스코프 동결(Post-MVP 백로그 분리)
- read-only health 연동 + 권한 거부/철회 폴백 UX

### Must NOT Have
- 모바일 코드/설정에 service-role 키 포함 금지
- Next Server Actions 직접 재사용 금지
- MVP 중 스코프 확장 금지
- Android는 Samsung SDK 직접 연동 금지(Health Connect 경유)
- 시작 차단형 health sync/raw event 영구저장/provider write-back 금지

## 버전 베이스라인 (MVP 고정)

- Runtime/Tooling: Node `20.19.4+`, npm `10.x`, TypeScript `5.8.x`
- Core RN: Expo SDK `54.x`, React Native `0.81.x`, React `19.1.x`, Expo Router `6.0.x`
- Data/State: Supabase JS `2.95.x`, React Query `5.90.x`, zustand `5.0.x`, zod `4.3.x`, react-hook-form `7.71.x`
- Native modules: `expo-secure-store`, `expo-image-picker`, `expo-notifications`(SDK 54 호환 핀)
- Observability: `@sentry/react-native` `7.x`
- Health libs: iOS `@kingstinct/react-native-healthkit@13.2.x`, Android `react-native-health-connect@3.5.x` + `expo-health-connect@0.1.1`

## 검증 전략(필수)

- 원칙: 사람 개입 최소화, 에이전트 중심 자동 검증
- 테스트: Vitest(+RN testing library), Maestro/Detox E2E, curl 계약 검증
- 모든 태스크는 happy/failure 시나리오 + 증적 경로 포함
- 증적 루트: `.sisyphus/evidence/`
- health 모듈 필수 시나리오: denied/revoked/provider-unavailable/timezone/idempotent-sync
- 릴리스 전 개인정보/스토어 컴플라이언스 아티팩트 확인 필수

## 실행 전략

### 병렬 Wave
- Wave 1: T1-T6 (Preflight + Foundation)
- Wave 2: T7-T12 (Identity + Core Data Plumbing)
- Wave 3: T13-T18 (Feature Migration Core)
- Wave 4: T24-T28 (Health Integration Priority)
- Wave 5: T19-T23, T29-T30 (Hardening + Release)
- FINAL: F1-F4 (Independent Review)

### 의존성 핵심
- 크리티컬 경로는 TL;DR의 경로를 우선 고수
- T20/T23은 다수 선행 태스크의 검증 결과를 요구
- T24~T30 health wave 결과가 릴리스 go/no-go를 직접 결정

## TODO 체크리스트 (원문 상태 동기화)

- [x] 1. 사전 결정 게이트(인증/딥링크/리포트/알림)
- [x] 2. 타입/스키마 계약 통합 및 드리프트 수정 계획
- [x] 3. Server Action 대체 매트릭스
- [x] 4. Expo 모바일 스켈레톤/디렉터리 베이스라인
- [x] 5. 환경 프로필 및 시크릿 처리 정책
- [x] 6. 모바일 워크스페이스 CI 베이스라인 및 빌드 검증
- [x] 7. Supabase RN 클라이언트 + 안전 세션 + Query Persist
- [x] 8. 인증 화면 + 라우트 가드 + 세션 UX
- [x] 9. 딥링크 reset/verify 종단 계약 구현
- [x] 10. 온보딩 플로우(3단계 + 재개 + 완료 라우팅)
- [x] 11. Next API용 공유 API 클라이언트 + Bearer 브리지
- [x] 12. 기록 업로드 어댑터(Image Picker/Compression/Progress)
- [ ] 13. 기록 기능 완성(결과 수정/삭제 + 히스토리 동기화)
- [ ] 14. 대시보드 집계 + 부분 실패 폴백 UX
- [ ] 15. 목표/습관 모듈 마이그레이션
- [ ] 16. 기분(Mood) 모듈 마이그레이션(날짜 upsert)
- [ ] 17. 프로필/아바타 마이그레이션
- [ ] 18. 주간 리포트/피드백 의존성 마이그레이션
- [ ] 19. 보안 베이스라인 + RLS/Storage 스모크 검증
- [ ] 20. 코어 E2E 자동화(MVP + 헬스 크리티컬 플로우)
- [ ] 21. 성능/관측성 하드닝
- [ ] 22. 구독 상태 + 웹 체크아웃 폴백 컴플라이언스
- [ ] 23. 베타/릴리스 준비(EAS + Runbook + Go/No-Go)
- [ ] 24. 헬스 연동 계약 및 데이터 모델 설계
- [ ] 25. iOS HealthKit Capability + 권한 플로우
- [ ] 26. Android Health Connect 제공자 연동
- [x] 27. 지연 동기화 엔진 + 데이터 무결성(Cursor + Idempotency)
- [x] 28. 헬스 지표 UX 통합(대시보드 + 리포트)
- [x] 29. 헬스 컴플라이언스/개인정보 패키지
- [x] 30. 헬스 Go/No-Go 게이트 + 롤백 제어

## 최종 검증 Wave (필수)

- [ ] F1. 계획 준수 감사(Plan Compliance Audit)
- [ ] F2. 코드 품질 리뷰(Code Quality Review)
- [ ] F3. 실제 QA 리플레이(Real QA Replay)
- [ ] F4. 스코프 충실성 점검(Scope Fidelity Check)

## 커밋 전략

- 사용자가 명시적으로 요청할 때만 커밋
- 태스크 단위 원자 커밋
- 증적 파일은 해당 태스크 변경과 함께 반영

## 성공 기준

- 요청 기능 100% 구현
- 수정 파일 LSP 진단 오류 0
- 관련 테스트/빌드 통과
- 문서/증적/체크리스트 상태 일치

---

## 참고

- 본 문서는 한국어 사용자를 위한 번역 동반 문서입니다.
- 세부 acceptance criteria와 각 태스크의 장문 실행 가이드는 원문(`docs/diet-hub-rn-migration-ultrawork.md`)을 기준으로 동기화됩니다.
