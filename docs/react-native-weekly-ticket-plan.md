# Diet Hub RN Rebuild Weekly Ticket Plan

기준 문서:

- `docs/react-native-rebuild-spec.md`
- `docs/react-native-mvp-checklist.md`

총 일정: 8주 (엄격 MVP), 1인 개발 + 파트타임 QA 가정

---

## Week 0 - Preflight Blockers (필수 선행)

## 목표

중간에 막히는 계약/의존성 이슈를 착수 전에 제거.

## Tickets

- `PRE-001` RN -> Next API 인증 계약 확정 (cookie 기반 유지 vs bearer 브리지 vs direct supabase)
- `PRE-002` reset-password/verify-email 딥링크 규약 확정 (iOS/Android 링크 + Supabase redirect URL)
- `PRE-003` 리포트 의존성 확정 (`/report` -> `/feedback` 구조 및 server action 대체 경로)
- `PRE-004` DB/API 계약 불일치 정리 (`feedback/generate`의 `food_name_ko` 항목 포함)
- `PRE-005` 타입 기준 통일 (`src/types/database.types.ts`만 사용, `src/types/supabase.ts` 사용 금지)
- `PRE-006` 알림 범위 결정 (`notification_settings`를 MVP에 포함할지 여부 확정)

## 종료 조건

- RN 구현 시작 전에 Blocker 6개 모두 해결
- 계약 문서(인증/딥링크/리포트/타입 기준)가 Notion에 확정

---

## Week 1 - Foundation and Auth Bootstrap

## 목표

Expo 프로젝트 기반과 인증 골격 완료.

## Tickets

- `MOB-001` Expo 앱 초기화 + TS strict + 폴더 구조 세팅
- `MOB-002` 환경변수/빌드 프로필(dev/staging/prod) 구성
- `MOB-003` Supabase RN client + secure session storage 연결
- `MOB-004` Auth 라우팅 가드(비로그인 -> auth, 로그인 -> protected)
- `MOB-005` 로그인/회원가입 UI 1차 구현
- `MOB-005A` iOS/Android 개발 빌드 서명/실기기 실행 파이프라인 검증

## 종료 조건

- 앱 실행 후 로그인 성공 시 protected 진입 가능
- 재실행 시 세션 자동 복원 동작

---

## Week 2 - Auth Complete + Onboarding

## 목표

인증 플로우 완성 + 온보딩 저장 완료.

## Tickets

- `MOB-006` 비밀번호 재설정/이메일 인증 안내 화면
- `MOB-007` Auth 에러 메시지 표준화
- `MOB-008` 온보딩 단계 화면(기본정보/신체정보/MBTI)
- `MOB-009` 온보딩 단계별 저장 및 재진입 구현
- `MOB-010` 온보딩 완료 상태 기반 라우팅 처리
- `MOB-010A` reset-password 및 이메일 인증 딥링크 end-to-end 검증

## 종료 조건

- 신규 계정이 온보딩 완료 후 대시보드 진입
- 중간 이탈 후 단계 복원 가능

---

## Week 3 - Record Core (Upload + Analyze)

## 목표

핵심 식단 기록 플로우 동작.

## Tickets

- `MOB-011` 식사 유형 선택 UI
- `MOB-012` 이미지 선택/촬영/미리보기
- `MOB-013` 업로드 진행률 UI
- `MOB-014` `POST /api/meal/upload` 연동
- `MOB-015` 분석 결과 화면 + 재촬영/확정
- `MOB-015A` `feedback/generate` 쿼리 필드 계약(`food_name` 계열) 정합성 검증/수정

## 종료 조건

- 기록 생성 완료율 목표치 달성(테스트 기준)
- 네트워크 실패 시 재시도 정상 동작

---

## Week 4 - Dashboard and History

## 목표

대시보드와 기록 히스토리로 사용자 루프 연결.

## Tickets

- `MOB-016` 대시보드 헤더/요약 카드
- `MOB-017` 오늘 식단 요약 데이터 연동
- `MOB-018` 목표 진행률 카드 연동
- `MOB-019` 기록 히스토리 리스트/상세
- `MOB-020` 캐시 전략(react-query persist) 적용
- `MOB-020A` RLS/Storage 정책 smoke test (핵심 CRUD + 업로드 권한)

## 종료 조건

- 대시보드/히스토리 핵심 조회 안정 동작
- 부분 실패 fallback UI 확인

---

## Week 5 - Goals, Habits, Mood

## 목표

일일 유지 루프(목표 + 기분) 완성.

## Tickets

- `MOB-021` 체중/칼로리 목표 설정 화면
- `MOB-022` 벌크/다이어트 방향 검증 + 오류 문구
- `MOB-023` 습관 목표 추가/완료 토글
- `MOB-024` 기분 기록 화면 + 날짜 upsert
- `MOB-025` 대시보드에 목표/기분 반영

## 종료 조건

- 목표 저장 검증 실패 케이스가 명확히 안내됨
- 기분 기록 재저장 시 중복 없이 업데이트

---

## Week 6 - Profile, Avatar, Weekly Report

## 목표

사용자 설정/리포트 핵심 기능 연결.

## Tickets

- `MOB-026` 프로필 조회/수정
- `MOB-027` 아바타 업로드 (`POST /api/avatar/upload`)
- `MOB-028` 주간 리포트 목록/상세 (`feedback` 탭/리포트 의존성 반영)
- `MOB-029` 피드백/TTS 연동(선택)
- `MOB-030` 오류/로딩/빈 상태 디자인 정리
- `MOB-030A` 리포트 server action 대체 경로(API/repository) 마이그레이션 완료

## 종료 조건

- 프로필 수정/아바타 업로드 안정 동작
- 주간 리포트 조회 UX 완성

---

## Week 7 - Stabilization and Beta Hardening

## 목표

품질 보강 + 내부 배포 준비.

## Tickets

- `MOB-031` Unit 테스트 보강
- `MOB-032` Integration 테스트(Supabase query/권한)
- `MOB-033` E2E 핵심 시나리오 5개 자동화
- `MOB-034` 크래시/에러 로깅(Sentry 등) 연결
- `MOB-035` 성능/메모리 점검 및 개선

## 종료 조건

- P0/P1 버그 0건
- 베타 배포 가능한 안정성 확보

---

## Week 8 - Release Preparation

## 목표

출시 체크리스트 완료 + 롤백 플랜 확정.

## Tickets

- `MOB-036` TestFlight/Internal Track 배포
- `MOB-037` 스토어 메타데이터/스크린샷 준비
- `MOB-038` 운영 대시보드(KPI/에러율) 설정
- `MOB-039` 릴리즈 노트/런북/롤백 문서화
- `MOB-040` GA go/no-go 리뷰

## 종료 조건

- 출시 승인 체크리스트 100% 충족
- 장애 대응 절차 문서화 완료

---

## 공통 Definition of Done

각 티켓은 아래를 만족해야 완료로 본다.

- 자기 리뷰 체크리스트 통과 (solo 개발 기준)
- 타입 에러 0
- 테스트 통과(해당 범위)
- 에러/로딩/빈 상태 처리 포함
- 추적 이벤트(analytics) 필요한 경우 포함
