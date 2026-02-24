# Diet Hub RN MVP Checklist

이 문서는 `docs/react-native-rebuild-spec.md`를 실제 구현으로 옮기기 위한 체크리스트다.

## 0) Preflight Blockers (착수 전 반드시 해결)

- [ ] RN -> Next API 인증 계약을 확정했다
  - [ ] 현재 쿠키 세션 전제 API를 RN에서 어떻게 인증할지 결정했다
  - [ ] 옵션 A: RN direct supabase query 우선 + API 최소 사용
  - [ ] 옵션 B: API에 Bearer 토큰 검증 브리지 추가
- [ ] 비밀번호 재설정/이메일 인증 딥링크 규약을 확정했다
  - [ ] 앱 스킴/유니버설 링크/Android App Link 설정
  - [ ] Supabase redirect URL 화이트리스트 등록
- [ ] 리포트 의존성 맵을 확정했다
  - [ ] `/report`가 실제로 `/feedback`으로 리다이렉트되는 구조를 반영했다
  - [ ] `report.actions.ts`의 server action 로직을 RN에서 쓸 API/서비스로 분해 계획 수립
- [ ] DB/API 계약 불일치 항목을 먼저 정리했다
  - [ ] `feedback/generate`의 `meal_items(food_name_ko)` 불일치 수정 계획 확정
  - [ ] 기준 타입은 `src/types/database.types.ts` 하나로 통일
  - [ ] `src/types/supabase.ts`는 레거시로 사용 금지 표시
- [ ] 알림 범위를 결정했다
  - [ ] `notification_settings`를 MVP에 넣을지(Post-MVP로 미룰지) 확정
  - [ ] 넣는다면 RN Push + DB 동기화까지 범위 정의

## 1) Scope Freeze Checklist

- [ ] MVP 화면 범위를 확정했다 (Auth, Onboarding, Record, Dashboard, Goals/Habits, Mood, Profile, Weekly Report)
- [ ] Post-MVP 항목을 별도 백로그로 분리했다 (Community 고도화, Monthly Premium 고도화, 고급 오프라인 큐)
- [ ] 기존 웹 기능과 1:1 파리티가 아닌 MVP 우선 원칙에 합의했다
- [ ] 출시 성공 지표(KPI)를 정의했다
  - [ ] D1, D7 리텐션
  - [ ] 식단 기록 완료율
  - [ ] 업로드 실패율
  - [ ] 앱 크래시율

## 2) Repository and App Skeleton

- [ ] `apps/mobile` (Expo) 프로젝트를 생성했다
- [ ] 폴더 구조를 고정했다
  - [ ] `app/` (expo-router)
  - [ ] `features/`
  - [ ] `infrastructure/`
  - [ ] `shared/`
- [ ] TypeScript strict 모드를 켰다
- [ ] 공통 린트/포맷 규칙을 정의했다
- [ ] 환경변수 규칙을 확정했다 (`EXPO_PUBLIC_*`)

## 3) Auth and Session

- [ ] Supabase RN 클라이언트를 구성했다
- [ ] 세션 저장소를 `expo-secure-store` 기반으로 연결했다
- [ ] 로그인 화면 구현 완료
- [ ] 회원가입 화면 구현 완료
- [ ] 비밀번호 재설정 화면 구현 완료
- [ ] 비밀번호 재설정이 실제 API 호출로 동작한다 (UI 상태 변경만으로 처리하지 않음)
- [ ] 이메일 인증/재설정 링크가 앱으로 복귀한다 (딥링크 end-to-end)
- [ ] 앱 재실행 시 세션 자동 복원 검증 완료
- [ ] refresh 실패 시 강제 로그아웃 UX 검증 완료

Acceptance:

- [ ] Cold start 후 인증 상태가 2초 내 안정적으로 복원된다
- [ ] 네트워크 불안정 상황에서 인증 오류 메시지가 사용자 친화적으로 노출된다

## 4) Onboarding

- [ ] 기본정보 입력 화면 구현
- [ ] 신체정보 입력 화면 구현
- [ ] MBTI 입력 화면 구현
- [ ] 단계별 저장/재진입 로직 구현
- [ ] 온보딩 완료 플래그 저장 검증

Acceptance:

- [ ] 중간 이탈 후 재진입 시 마지막 단계가 유지된다

## 5) Record (Meal Upload + AI)

- [ ] 식사 유형 선택 UI 구현
- [ ] 이미지 선택/촬영 플로우 구현
- [ ] 업로드 진행률 UI 구현
- [ ] `POST /api/meal/upload` 연동
- [ ] AI 분석 실패 fallback UI 구현
- [ ] 결과 저장 후 기록 히스토리 반영

Acceptance:

- [ ] 업로드 성공률 목표치(예: 95%+)를 만족한다
- [ ] 실패 재시도 버튼으로 정상 복구 가능하다

## 6) Dashboard

- [ ] 요약 카드 UI 구현
- [ ] 오늘 식단 요약 연동
- [ ] 목표 진행률 연동
- [ ] 습관 카드 연동
- [ ] 기분 요약 연동

Acceptance:

- [ ] 캐시 히트 시 대시보드 첫 렌더가 2초 내 완료된다
- [ ] 일부 데이터 실패 시 전체 화면이 깨지지 않는다

## 7) Goals and Habits

- [ ] 체중 목표 설정 UI 구현
- [ ] 칼로리 목표 설정 UI 구현
- [ ] 습관 추가/완료 토글 구현
- [ ] 벌크/다이어트 방향 검증 구현
- [ ] 저장 오류 메시지 구체화

Acceptance:

- [ ] 잘못된 방향 목표(벌크인데 목표체중 <= 현재체중) 저장이 차단된다

## 8) Mood

- [ ] 일일 기분 입력 UI 구현
- [ ] 스트레스/수면 필드 저장 구현
- [ ] 날짜별 upsert 동작 확인

Acceptance:

- [ ] 동일 날짜 재저장 시 중복 레코드 없이 업데이트된다

## 9) Profile and Avatar

- [ ] 프로필 조회/수정 UI 구현
- [ ] 아바타 업로드 UI 구현
- [ ] `POST /api/avatar/upload` 연동

Acceptance:

- [ ] 대용량/지원 불가 이미지 예외가 정확히 안내된다

## 10) Weekly Report

- [ ] 주간 리포트 목록/상세 조회 구현
- [ ] 주간 리포트 생성 트리거 구현
- [ ] 공유 이미지 생성/링크 처리 구현(선택)
- [ ] 리포트 데이터 소스가 `feedback` 탭 구조 의존을 반영한다
- [ ] `report.actions.ts` 대체 경로(API 또는 repository)가 준비된 뒤 UI 구현한다

Acceptance:

- [ ] 데이터 없는 주차 처리 UX가 명확하다

## 11) Security and Compliance Baseline

- [ ] 모바일 코드에 service-role 키가 없다
- [ ] 민감 정보 로그 마스킹이 적용되었다
- [ ] 토큰/세션 외 민감 데이터를 secure store에 과도 저장하지 않는다
- [ ] 계정 삭제/로그아웃 시 로컬 캐시 삭제 정책이 있다

## 12) QA and Release Gates

- [ ] Unit 테스트 통과
- [ ] 통합 테스트(Repository + Supabase) 통과
- [ ] 핵심 E2E 5개 시나리오 통과
- [ ] iOS/Android 내부 배포(TestFlight/Internal) 완료
- [ ] 크래시율, API 에러율 모니터링 대시보드 준비 완료
- [ ] RLS/Storage 정책 smoke test를 MVP 초기에 완료했다 (후반이 아님)

Release gate:

- [ ] P0/P1 이슈 0건
- [ ] 기록 핵심 플로우 블로커 0건
- [ ] 롤백 플랜 문서화 완료
