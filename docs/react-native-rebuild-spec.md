# Diet Hub React Native Rebuild Master Spec

## 0) 문서 목적

이 문서는 현재 Next.js + Supabase 기반 Diet Hub를 **React Native(Expo) 앱으로 재구축**하기 위한 실행 명세서다.

- 대상 독자: 제품 오너, RN 개발자, 백엔드/DB 담당, AI 코딩 에이전트
- 목표: 이 문서만으로 `MVP 범위 -> 설계 -> 구현 -> 검증 -> 출시`를 순차 실행 가능하게 만들기
- 기준: 현재 레포 실제 구현/쿼리 패턴을 분석하여 작성

---

## 1) 현재 시스템 분석 요약 (근거 기반)

### 1.1 현재 앱 구조

- 프레임워크: Next.js App Router (`src/app`)
- 서버 비즈니스 로직 중심: Server Actions (`src/lib/actions/*.ts`)
- API Route 사용: 이미지 업로드/AI 피드백/TTS/구독/커뮤니티 등 (`src/app/api/**/route.ts`)
- DB: Supabase(Postgres + RLS + Storage + Functions/Views)
- 타입 소스: `src/types/database.types.ts`

### 1.2 핵심 도메인(현재 구현된 것)

- 인증: `src/lib/actions/auth.actions.ts`
- 온보딩: `src/lib/actions/onboarding.actions.ts`
- 식단 기록: `src/app/(protected)/record/page.tsx`, `src/app/api/meal/upload/route.ts`, `src/lib/actions/meal.actions.ts`
- 대시보드: `src/app/(protected)/dashboard/page.tsx`, `src/lib/actions/dashboard.actions.ts`
- 목표/습관: `src/app/(protected)/goals/page.tsx`, `src/lib/actions/goals.actions.ts`
- 기분 기록: `src/lib/actions/mood.actions.ts`
- 리포트: `src/lib/actions/report.actions.ts`
- 프로필/아바타: `src/lib/actions/profile.actions.ts`, `src/app/api/avatar/upload/route.ts`
- 커뮤니티: `src/app/community/page.tsx`, `src/app/api/community/**`
- 구독(토스): `src/app/api/subscription/**`
- AI 피드백/TTS/공유 이미지: `src/app/api/feedback/**`, `src/app/api/share/weekly-report/route.ts`

### 1.3 DB 핵심 테이블(현재)

주요 테이블: `user_profiles`, `meal_records`, `meal_items`, `daily_moods`, `goals`, `habit_logs`, `weight_logs`, `weekly_reports`, `monthly_reports`, `subscriptions`, `payment_history`, `community_posts`, `community_comments`, `community_likes`, `share_images`, `ai_feedbacks`, `usage_logs`.

근거 파일:

- 타입: `src/types/database.types.ts`
- 마이그레이션: `supabase/migrations/*.sql`

### 1.4 재구축 시 주의할 현재 레거시/드리프트 포인트

- 일부 코드에서 타입 약화(`as any`) 흔적이 존재 (예: 커뮤니티 API route)
- Server Action 중심 구조는 RN에서 직접 재사용 불가
- 따라서 비즈니스 로직 이동 전략(Edge Function/API BFF/클라이언트 direct query 분리)이 필수

---

## 2) 전략 결정: DB 재사용 vs 신규

## 결론 (권장)

**DB는 재사용한다.**

이유:

1. 이미 서비스 도메인 테이블/리포트/구독/커뮤니티까지 구성됨
2. RLS/트리거/스토리지 정책이 이미 운영 패턴을 가짐
3. 신규 DB 재설계는 일정+리스크를 크게 증가시킴

신규 DB가 필요한 경우(예외):

- 데이터 품질이 심각하게 깨져 있거나
- 기존 RLS 정책이 복구 불가 수준으로 복잡하거나
- 도메인 자체를 전면 변경할 경우

현재 분석 기준에서는 **신규 DB 생성보다 기존 DB 재사용 + 점진 개선**이 훨씬 유리.

---

## 3) 목표 아키텍처 (React Native)

## 3.1 기술 선택 (권장)

- RN 프레임워크: Expo Managed Workflow
- 네비게이션: Expo Router
- 서버 연동: `@supabase/supabase-js`
- 상태: Zustand + TanStack Query
- 폼/검증: React Hook Form + Zod
- 보안 저장소: `expo-secure-store`
- 이미지 처리/업로드: Expo Image Picker + 서버 API(기존 `/api/meal/upload`, `/api/avatar/upload`)
- 알림: Expo Notifications

## 3.2 모듈 구조(권장)

```text
apps/mobile/src/
  app/                        # 라우트 (expo-router)
    (auth)/
    (protected)/
  features/
    auth/
    onboarding/
    dashboard/
    record/
    goals/
    mood/
    report/
    profile/
    subscription/
    community/
    feedback/
  entities/                   # 도메인 타입/모델
  shared/
    ui/
    lib/
    constants/
  infrastructure/
    supabase/
    api/
    storage/
    notifications/
```

## 3.3 데이터 접근 원칙

- 원칙 A: **사용자 스코프 CRUD는 RN에서 Supabase direct query**
- 원칙 B: 멀티 테이블 트랜잭션/외부 API 호출/비용 로직은 **서버 API(Next route 또는 Supabase Edge Function)**
- 원칙 C: service-role 키는 모바일 앱에 절대 포함 금지

---

## 4) 기능 명세 (MVP / Post-MVP 분리)

## 4.1 MVP 범위 (반드시 먼저)

1. 인증/세션 유지
2. 온보딩 저장
3. 식단 기록(이미지 업로드 + AI 분석 결과 저장)
4. 대시보드(오늘 섭취/목표/스트릭)
5. 목표/습관
6. 기분 기록
7. 프로필 편집/아바타 업로드
8. 주간 리포트 조회/생성

Post-MVP:

- 커뮤니티 고도화
- 월간 리포트 프리미엄 흐름 고도화
- 고급 오프라인 쓰기 큐
- 헬스 연동(브릿지앱 포함)

## 4.2 도메인별 상세 명세

### A. Auth

- 화면:
  - 로그인
  - 회원가입
  - 이메일 인증 안내
  - 비밀번호 재설정
- 백엔드:
  - Supabase Auth 직접 사용
  - OAuth는 WebView 또는 external browser 플로우
- 성공 기준:
  - 앱 재실행 시 세션 자동 복원
  - 만료 토큰 자동 refresh 실패 시 명시적 로그아웃

### B. Onboarding

- 화면:
  - 기본정보
  - 신체정보
  - MBTI
- 저장 대상:
  - `user_profiles` 주요 컬럼
- 성공 기준:
  - 단계 저장 재진입 가능
  - 완료 시 대시보드로 이동

### C. Record (핵심)

- 화면:
  - 식사 유형 선택
  - 사진 업로드
  - 분석 로딩
  - 분석 결과/수정
- 서버 경로:
  - 이미지+AI: `POST /api/meal/upload`
  - 결과 수정/삭제: Supabase direct + 필요한 경우 기존 API
- 저장 대상:
  - `meal_records`, `meal_items`, Storage `meal-images`
- 성공 기준:
  - 업로드 실패/AI 실패 fallback UX
  - 기록 후 히스토리 반영

### D. Dashboard

- 화면:
  - 요약 카드, 스트릭, 오늘 식단, 기분
- 데이터 소스:
  - 기존 `getDashboardData` 로직을 모바일 서비스 계층으로 분해
  - 또는 임시로 BFF endpoint 제공
- 성공 기준:
  - TTI 2초 내(캐시 기준)
  - 데이터 실패 시 부분 fallback

### E. Goals / Habits

- 화면:
  - 체중/칼로리 목표
  - 습관 목표 추가/완료
- 저장 대상:
  - `user_profiles`, `goals`, `habit_logs`
- 성공 기준:
  - 벌크/다이어트 목표 방향 검증
  - 저장 실패 사유 문구 구체화

### F. Mood

- 화면:
  - 오늘 기분 + 스트레스 + 수면 등
- 저장 대상:
  - `daily_moods`
- 성공 기준:
  - 날짜 단위 upsert

### G. Profile

- 화면:
  - 프로필 조회/수정
  - 아바타 업로드
- 서버 경로:
  - `POST /api/avatar/upload` 재사용
- 저장 대상:
  - `user_profiles`, Storage `avatars`

### H. Report

- 화면:
  - 주간 리포트
  - (MVP 선택) 월간 리포트 조회만
- 백엔드:
  - `report.actions.ts` 로직을 API/BFF로 이동 또는 함수화
- 성공 기준:
  - 주간 생성/조회 안정 동작

### I. Subscription (MVP 후반)

- 모바일 결제 정책 이슈로 웹과 완전 동일 구현은 보류 가능
- 우선순위:
  - 구독 상태 조회/표시
  - 결제 흐름은 웹 checkout 유도(초기)

---

## 5) DB 재사용 설계

## 5.1 재사용 테이블 매핑

- `user_profiles`: 사용자/온보딩/목표 핵심
- `meal_records` + `meal_items`: 기록 핵심
- `daily_moods`: 감정 로그
- `goals` + `habit_logs`: 목표/습관
- `weight_logs`: 체중 추적
- `weekly_reports`/`monthly_reports`: 리포트
- `subscriptions`/`payment_history`: 구독/결제
- `ai_feedbacks`: AI 피드백

## 5.2 신규 추가 권장 테이블 (RN 전용 운영성)

1) `device_push_tokens`

- 목적: 사용자 디바이스 푸시 토큰 관리
- 컬럼 예시:
  - `id uuid pk`
  - `user_id uuid not null`
  - `platform text check ('ios','android')`
  - `expo_push_token text unique`
  - `device_id text`
  - `is_active boolean default true`
  - `created_at`, `updated_at`

2) `mobile_sync_events` (선택)

- 목적: 오프라인/재시도/충돌 분석 로그
- MVP에서는 생략 가능, 베타부터 도입 권장

## 5.3 RLS 기준

- 모든 사용자 데이터 테이블은 `auth.uid() = user_id` 기본
- admin/service-role만 접근해야 하는 작업은 Edge/API에서 수행
- Storage 경로 정책: 현재와 동일한 사용자 폴더 규칙 유지

---

## 6) Server Actions -> RN 전환 설계

RN에서는 Server Action을 직접 호출할 수 없으므로 아래 3패턴으로 변환한다.

### 패턴 1: direct supabase query (권장 기본)

- 대상: 단일 테이블 사용자 스코프 CRUD
- 예: mood save, meal list, goals list

### 패턴 2: API Route 재사용 (단기)

- 대상: 파일 업로드 + AI 분석 + 외부 결제 연동
- 예: `/api/meal/upload`, `/api/avatar/upload`, `/api/feedback/generate`, `/api/subscription/*`

### 패턴 3: Supabase Edge Function 전환 (중기)

- 대상: 서버 의존도가 큰 로직을 Next에서 분리하고 싶을 때
- 효과: 모바일/웹 공통 백엔드 확보

---

## 7) API/서비스 계약 명세 (RN 기준)

## 7.1 재사용 API (즉시 사용)

- `POST /api/meal/upload`
  - 입력: image, date, mealType
  - 출력: mealId + AI summary + image URL
- `POST /api/avatar/upload`
  - 입력: avatar file
  - 출력: avatar_url
- `POST /api/feedback/generate`
- `POST /api/feedback/tts`
- `POST /api/share/weekly-report`
- `GET/POST /api/subscription*`

## 7.2 RN 서비스 인터페이스 예시

```ts
interface RecordService {
  uploadMealImage(input: { fileUri: string; mealType: string; date: string }): Promise<MealUploadResult>
  getMealsByDate(date: string): Promise<MealRecord[]>
  updateMeal(recordId: string, patch: MealPatch): Promise<void>
}
```

---

## 8) 오프라인/동기화 정책

MVP:

- 읽기 캐시 중심(react-query persist)
- 쓰기는 온라인 우선
- 실패 시 재시도 버튼 + 명시적 오류

Post-MVP:

- write queue
- idempotency key
- 충돌 해소 정책(last-write-wins + 사용자 확인)

---

## 9) 보안/운영/관측성

## 9.1 보안

- 세션 저장: `expo-secure-store`
- service-role 키 모바일 금지
- 민감 데이터 로그 마스킹
- 토큰 재발급 실패 시 강제 로그아웃

## 9.2 운영

- 에러 추적: Sentry 권장
- 이벤트 분석: PostHog/Firebase Analytics 중 1개
- 핵심 KPI:
  - D1/D7 retention
  - 기록 완료율
  - 업로드 실패율
  - API 실패율

## 9.3 성능 목표

- 앱 cold start < 3초(중간급 디바이스)
- 기록 업로드 평균 < 5초(4G 기준)

---

## 10) 구현 단계별 계획 (현실 일정)

## Phase 0 (3~5일): 분석/스코프 고정

- 산출물:
  - 화면 파리티 매트릭스
  - MVP 범위 고정 문서
  - 기술 선택 확정(Expo/Supabase/RN libs)

## Phase 1 (1.5~2주): 앱 골격 + 인증

- Expo 앱 생성, 라우팅, 테마, 공통 UI
- Supabase Auth + 세션 복원
- 로그인/회원가입/비밀번호 재설정

## Phase 2 (3~4주): 핵심 기능

- 온보딩
- 식단 기록/업로드/결과
- 대시보드
- 목표/습관
- 기분 기록
- 프로필/아바타
- 주간 리포트

## Phase 3 (1.5~2주): 안정화

- 통합 테스트
- 크래시/에러 튜닝
- 베타 배포(TestFlight/Internal)

## Phase 4 (3~5일): 런치

- 스토어 메타데이터
- 롤백 시나리오
- 모니터링 대시보드 오픈

총 소요(1인 풀타임 + 부분 QA): **7~10주**

---

## 11) 테스트 명세

## 11.1 테스트 레벨

- Unit: 유틸/검증/도메인 계산
- Integration: Supabase repository + RLS 시나리오
- E2E: 로그인 -> 기록 -> 대시보드 -> 리포트 핵심 플로우

## 11.2 필수 E2E 시나리오

1. 신규 가입 -> 온보딩 완료 -> 대시보드 진입
2. 식단 이미지 업로드 -> 분석 저장 -> 기록 히스토리 반영
3. 목표 수정 -> 대시보드 목표 카드 반영
4. 기분 기록 -> 피드백 생성
5. 로그아웃 -> 재로그인 -> 세션 복원

---

## 12) AI 코딩(바이브 코딩) 실행 프롬프트 템플릿

## 12.1 공통 프롬프트

```text
You are implementing Diet Hub Mobile (Expo + React Native + Supabase).
Follow docs/react-native-rebuild-spec.md exactly.
Rules:
1) Keep strict TypeScript (no any, no ts-ignore).
2) Reuse existing DB schema and API contracts unless explicitly marked redesign.
3) Implement one feature module at a time with tests.
4) Output changed files and runnable verification commands.
```

## 12.2 단계별 프롬프트 예시

Auth 모듈:

```text
Implement mobile auth module:
- screens: Login, Signup, ForgotPassword
- supabase auth session restore with secure storage
- navigation guards for protected routes
- form validation with zod
- tests for auth service and form validation
```

Record 모듈:

```text
Implement meal record module:
- meal type selection, image picker, upload progress
- call POST /api/meal/upload
- render analysis result and save confirmation flow
- history list by date
- include retry and error states
```

---

## 13) 리스크와 대응

1. 범위 과다

- 대응: MVP 고정, 신규 요청은 Post-MVP backlog로 이동

2. Server Action 의존 로직 누락

- 대응: action별 전환 매트릭스 문서화 후 진행

3. 결제/스토어 정책 변수

- 대응: MVP에서 결제 최소화, 웹 결제 fallback 유지

4. 모바일 퍼포먼스 저하

- 대응: 이미지 선압축, 쿼리 페이징, 캐시 전략

---

## 14) 최종 권고 (의사결정)

1. **DB는 재사용한다** (현 구조 충분히 성숙)
2. **RN MVP는 코어 기능만** (기록/대시보드/목표/기분/프로필/주간리포트)
3. Server Action 로직은 direct query + API route 재사용으로 단계 전환
4. 결제/커뮤니티/고급 기능은 베타 이후 확장

이 방식이 현재 팀 역량과 일정에서 가장 안정적이고 빠르다.
