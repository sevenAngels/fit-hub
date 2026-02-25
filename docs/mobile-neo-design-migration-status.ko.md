# Mobile Neo Design Migration Status (RN)

## 목적

- `diet-hub`의 네오브루탈 감성을 참고하되, React Native(Expo) 환경에서 유지보수 가능한 공통 디자인 시스템으로 정리한다.
- 현재까지 적용된 작업과 남은 작업을 구분해 다음 라운드에서 일관성 있게 이어간다.

## 현재 완료된 작업

### 1) 하드코딩 색상 제거

- `apps/mobile` 기준 화면 코드의 하드코딩 색상은 제거되었고, 색상 리터럴은 `apps/mobile/src/shared/ui/neo-theme.ts`에만 존재한다.
- 검증 기준: `apps/mobile` 전체에서 `#...`/`rgba(...)`/`hsl(...)` 검색 시 테마 파일만 매치.

### 2) 공통 토큰/기반 스타일 정리

- 공통 토큰: `neoColors`, `neoShape` (`apps/mobile/src/shared/ui/neo-theme.ts`)
- 네오 카드 기반: `neoCardBase`
- 네오 버튼 기반: `neoPrimaryButtonBase`
- 하드 섀도우 규칙: `neoHardShadow` (iOS shadow / Android elevation)

### 3) 공통 프리미티브 추가

- `apps/mobile/src/shared/ui/neo-primitives.tsx`
  - `NeoInput`
  - `NeoButton` (`primary`/`secondary`/`accent`/`danger` variant)
  - `NeoCard` (정의 완료, 화면 적용은 일부 미완)

### 4) 화면 반영 현황

- `NeoInput` 적용 완료:
  - auth: `apps/mobile/app/(auth)/index.tsx`, `apps/mobile/app/(auth)/forgot-password.tsx`, `apps/mobile/app/(auth)/reset-password.tsx`
  - protected: `apps/mobile/app/(protected)/feedback.tsx`, `apps/mobile/app/(protected)/goals.tsx`, `apps/mobile/app/(protected)/mood.tsx`, `apps/mobile/app/(protected)/onboarding.tsx`, `apps/mobile/app/(protected)/profile.tsx`, `apps/mobile/app/(protected)/record-upload.tsx`, `apps/mobile/app/(protected)/record-history.tsx`, `apps/mobile/app/(protected)/record/[id].tsx`
- `NeoButton` 부분 적용:
  - `apps/mobile/app/(auth)/index.tsx`
  - `apps/mobile/app/(auth)/forgot-password.tsx`
  - `apps/mobile/app/(auth)/reset-password.tsx`
  - `apps/mobile/app/(protected)/onboarding.tsx`
  - `apps/mobile/app/(protected)/health.tsx`
  - `apps/mobile/app/(protected)/subscription-callback.tsx`
- `neoCardBase` 반영 완료(StyleSheet 확장):
  - `apps/mobile/app/(protected)/index.tsx`
  - `apps/mobile/app/(protected)/feedback.tsx`
  - `apps/mobile/app/(protected)/goals.tsx`
  - `apps/mobile/app/(protected)/mood.tsx`
  - `apps/mobile/app/(protected)/profile.tsx`
  - `apps/mobile/app/(protected)/record-history.tsx`
  - `apps/mobile/app/(protected)/record/[id].tsx`
  - `apps/mobile/app/(protected)/subscription.tsx`

## 남은 작업 (우선순위 순)

### P1. 버튼 컴포넌트 통일 마무리 (완료)

- 목적: 남아 있는 `Pressable + styles.primaryButton/secondaryButton/button` 조합을 `NeoButton`으로 통일.
- 진행 결과: 대상 예시 파일 전체에서 `Pressable + styles.primaryButton/secondaryButton/button` 조합 제거, `NeoButton` 적용 완료.
- 대상 예시:
  - `apps/mobile/app/(protected)/index.tsx`
  - `apps/mobile/app/(protected)/feedback.tsx`
  - `apps/mobile/app/(protected)/profile.tsx`
  - `apps/mobile/app/(protected)/mood.tsx`
  - `apps/mobile/app/(protected)/record-history.tsx`
  - `apps/mobile/app/(protected)/subscription.tsx`
  - `apps/mobile/app/(protected)/record/[id].tsx`
  - `apps/mobile/app/(protected)/goals.tsx`
  - `apps/mobile/app/(protected)/record-upload.tsx`

### P1. 카드 컴포넌트 치환 마무리 (완료)

- 목적: `View style={styles.card}` / `Pressable style={styles.card}` 반복을 `NeoCard` 기반으로 통일.
- 진행 결과: 대상 예시 파일 전체에서 `View style={styles.card}` / `Pressable style={styles.card}` 패턴 제거, `NeoCard` 기반으로 치환 완료.

### P2. 칩/배지/상태 배너 공통 컴포넌트화

- 목적: screen별로 반복되는 `choiceChip`, `chip`, `errorCard`, `staleBadge`, `retry` 블록을 `NeoChip`/`NeoStatusCard`/`NeoNotice`로 추상화.
- 기대 효과: 디자인 일관성 + 상태 스타일 변경 비용 절감.

### P2. 문서화/규칙 고정

- `apps/mobile/src/shared/ui` 하위에 “토큰만 사용” 규칙 추가
- 신규 화면 개발 시 금지 규칙 명시:
  - hex 색상 직접 입력 금지
  - 임의 border/shadow 값 하드코딩 금지

## diet-hub 디자인 참고 원칙 (RN 관점)

## 참고해야 할 것 (Keep)

- 네오브루탈 핵심 대비: 두꺼운 보더, 강한 명도 대비, 명확한 상태색
- 컴포넌트 기반 시각 규칙: Card/Button/Input/Chip의 일관된 형태
- 상태 가시성 우선 UX: 에러/경고/성공을 즉시 구분 가능한 색 체계
- 화면 위계: 타이틀-섹션-카드-행동버튼의 명확한 구조

## 버려야 할 것 (Discard)

- Web 전용 스타일 전략: Tailwind class 체인, 글로벌 CSS 변수 의존, hover/focus 기반 상호작용
- Web 전용 효과 과다: backdrop-filter, CSS pseudo-element, 과한 blur/filter
- 데스크톱 중심 레이아웃 밀도: 작은 터치 영역/다단 정보 과밀 구성
- 픽셀 단위 미세 보정에 과도한 집착: RN 기기별 렌더 차이를 무시하는 고정값 남발

## RN에서의 실무 가이드

- 우선순위: 시각 동일성 100%보다 터치 안정성/성능/가독성
- 기본 원칙:
  - 터치 타겟 충분히 확보(버튼/칩 최소 높이 유지)
  - 텍스트 길이 변화/다국어에서 레이아웃 깨짐 없는 구조 우선
  - iOS/Android 그림자 차이는 토큰 레벨에서 흡수 (`neoHardShadow`)

## 검증 체크리스트

- 정적 검증: `lsp_diagnostics` 오류 0
- 타입 검증: `npm run typecheck --workspace apps/mobile`
- 린트: `npm run lint --workspace apps/mobile` (기존 경고와 신규 경고 분리 확인)
- 테스트: `npm run test:run --workspace apps/mobile`
- 빌드: `npm run build --workspace apps/mobile`

## 최종 재검증 로그 (2026-02-25, ULW)

- 디자인 규칙 재검증 완료:
  - `apps/mobile`에서 hex/`rgba`/`hsl` 색상 리터럴은 `apps/mobile/src/shared/ui/neo-theme.ts` 외 매치 없음.
  - `apps/mobile/app/(protected)`에서 `View style={styles.card}` / `Pressable style={styles.card}` 매치 없음.
  - `apps/mobile/app/(protected)`에서 `Pressable + styles.primaryButton/secondaryButton/button` 매치 없음.
- 검증 명령 재실행 결과:
  - `npm run typecheck --workspace apps/mobile` 통과
  - `npm run lint --workspace apps/mobile` 통과(기존 경고 3건 유지)
  - `npm run test:run --workspace apps/mobile` 통과
  - `npm run build --workspace apps/mobile` 통과

## 메모

- 현재 디자인 토큰/프리미티브 기반으로 충분히 구조가 잡혔고, 다음 라운드는 “남은 Pressable/Card 반복을 컴포넌트로 수렴”하는 마감 작업이 핵심이다.
