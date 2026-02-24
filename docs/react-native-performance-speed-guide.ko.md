# React Native 성능·속도 개선 실전 가이드 (3·4·5장 중심)

작성일: 2026-02-24
목표: 신규/운영 중 RN 앱에서 바로 적용 가능한 성능·속도 개선 체크리스트 제공

---

## 3. React Native 성능 구조: 어디서 느려지는가

### 3.1 스레드/런타임 구조를 먼저 본다

React Native 성능 문제는 대부분 "어느 실행 경로가 병목인지"를 먼저 구분하면 빠르게 좁혀진다.

- JavaScript Thread
  - React 렌더링, 상태 업데이트, 비즈니스 로직, 네트워크 후처리 등을 수행한다.
  - 60fps 기준 프레임 예산은 약 16.67ms이며, JS 작업이 길어지면 프레임 드랍이 발생한다.

- UI(Main) Thread
  - 실제 네이티브 뷰 그리기, 터치/스크롤 처리, 레이아웃/드로잉을 수행한다.
  - 레이아웃 연산 과다, 이미지 디코딩 부담, 복잡한 뷰 계층은 입력 지연과 스크롤 끊김을 만든다.

- JS-Native 경로 (Legacy Bridge / New Architecture)
  - Legacy 구조에서는 직렬화/역직렬화 비용이 있는 비동기 브리지 비용이 병목이 될 수 있다.
  - New Architecture(Fabric/TurboModules/JSI)에서는 이 경로 비용을 줄일 수 있다.
  - 단, New Architecture를 켠다고 성능이 자동으로 좋아지는 것은 아니며 앱 코드 구조 최적화가 여전히 필요하다.

### 3.2 Hermes와 New Architecture 기준점

- Hermes
  - 최신 RN에서는 기본 엔진이며, 릴리스 빌드에서 바이트코드 기반 로딩으로 시작 성능과 메모리 사용량 개선에 유리하다.
  - 적용 여부는 `global.HermesInternal` 등으로 확인하고, 반드시 릴리스 빌드에서 전/후 비교한다.

- New Architecture
  - 최신 RN 버전대에서는 기본 활성화가 일반적이다.
  - 장점: JS-Native 인터페이스 개선, React 18 동시성 기능 활용 기반, 렌더 경로 개선.
  - 주의: 이득은 앱 특성에 따라 다르며, 리스트/상태/이미지/애니메이션 구조 개선이 병행되어야 체감된다.

개발 시 적용 포인트

- 화면 전체 반응이 둔함: JS Thread(리렌더, 계산, 상태 설계) 우선 점검
- 터치/스크롤만 끊김: UI Thread(레이아웃, 이미지, 애니메이션) 우선 점검
- 네이티브 모듈 연동 시 급격히 느림: JS-Native 호출 빈도/데이터량 점검

---

## 4. 주요 성능 이슈와 체크리스트

### 4.1 디버그 vs 릴리스 빌드 분리

디버그 빌드는 개발 오버헤드로 인해 실제보다 느리다. 성능 판정은 항상 릴리스 기준으로 한다.

체크리스트

- [ ] 같은 시나리오를 디버그/릴리스에서 각각 측정했는가?
- [ ] 성능 이슈 보고/회고는 릴리스 수치 기준으로 기록했는가?

### 4.2 리스트/스크롤 성능 (FlatList/SectionList)

필수 원칙

1. 긴 리스트는 `ScrollView` 대신 `FlatList`/`SectionList` 사용
2. `keyExtractor`는 고유 ID 사용 (index key 지양)
3. `renderItem`/핸들러는 참조 안정화(`useCallback`), 아이템은 `React.memo`
4. 고정 높이 리스트는 `getItemLayout` 적용
5. `initialNumToRender`, `maxToRenderPerBatch`, `updateCellsBatchingPeriod`, `windowSize`는 기기별 튜닝
6. `removeClippedSubviews`는 iOS에서 레이아웃/transform 이슈 가능성을 고려해 화면별 검증 후 사용

체크리스트

- [ ] 대량 리스트에서 가상화 리스트를 사용 중인가?
- [ ] 아이템 컴포넌트가 불필요하게 무겁지 않은가?
- [ ] 썸네일/해상도 분리 및 캐시 전략이 적용됐는가?
- [ ] 빠른 스크롤 시 blank area/입력 지연 중 어느 쪽이 문제인지 구분했는가?

### 4.3 불필요한 리렌더와 상태 경계

문제 패턴

- 전역 상태에 고빈도 변경값(입력/스크롤/임시 UI 상태)까지 넣음
- 큰 Context 하나에 과도한 값/컴포넌트를 연결
- 매 렌더마다 새 함수/객체를 props로 전달

개선 원칙

- 전역 상태는 "정말 전역"만 유지하고 화면 로컬 상태를 분리
- Context는 의미 단위로 쪼개기
- `React.memo`, `useMemo`, `useCallback`을 측정 기반으로 적용
- 화면 컴포넌트는 UI 중심, 데이터 가공/사이드이펙트는 custom hook으로 분리

체크리스트

- [ ] 특정 state 변경 시 리렌더 범위를 확인했는가?
- [ ] 전역 상태/Context 구독 범위를 최소화했는가?
- [ ] 메모이제이션을 무작정이 아니라 병목 구간에 적용했는가?

### 4.4 JS-Native 왕복 호출 과다

위험 패턴

- 스크롤/제스처 중 고주기 네이티브 호출
- 센서/위치 이벤트를 과도한 주기로 JS에 전달
- 대용량 payload를 자주 직렬화해서 전송

개선 원칙

- 네이티브에서 1차 처리 후 요약값만 전달
- 이벤트 샘플링/배치 적용
- 호출 횟수와 payload 크기를 같이 줄이는 방향으로 설계

### 4.5 메모리 누수/리소스 정리

필수 항목

- `setInterval`, `setTimeout`, `requestAnimationFrame` cleanup
- EventEmitter/WebSocket/네이티브 구독 해제
- 화면 포커스/블러 기준으로 리스너 생명주기 제어

체크리스트

- [ ] 모든 `useEffect`가 cleanup을 갖는가?
- [ ] 화면 이탈 후 타이머/구독이 남지 않는가?
- [ ] 화면 전환 반복 시 메모리 우상향 여부를 프로파일링했는가?

### 4.6 애니메이션/제스처

- JS Thread 의존 애니메이션은 JS 부하 시 끊기기 쉽다.
- 복잡한 제스처/애니메이션은 `react-native-reanimated` + `react-native-gesture-handler` 조합을 우선 검토한다.
- `Animated` 사용 시 `useNativeDriver`는 가능한 속성에서만 적용 가능하므로, "항상 true"가 아니라 "가능하면 true"로 운영한다.

### 4.7 번들 크기/초기 구동 시간

개선 원칙

- 미사용 라이브러리 제거 및 중복 의존성 정리
- 큰 화면/기능은 lazy loading(`React.lazy`, dynamic import)으로 지연 로딩
- 모듈 top-level side effect를 줄여 로딩 최적화 방해 요소 제거
- Expo 프로젝트는 `inlineRequires` 설정 효과/부작용을 확인 후 적용

---

## 5. 개발 시 바로 적용할 실천 가이드

### 5.1 설계 단계 체크포인트

1. 성능 민감 화면(리스트/피드/차트/미디어)을 먼저 정의한다.
2. 이미지 정책(썸네일/원본, CDN 리사이즈, 캐시 만료)을 먼저 정한다.
3. 상태 경계(전역/화면/컴포넌트)를 문서화해 리렌더 폭발을 사전에 막는다.

### 5.2 코딩 규칙으로 고정할 항목

- 화면 컴포넌트는 UI 중심, 로직은 hook/service로 분리
- 리스트 템플릿 기본값을 팀 규칙으로 통일 (`keyExtractor`, memo, 배치 옵션, 이미지 정책)
- 타이머/리스너/구독은 "등록+해제"를 한 세트로 구현
- PR 체크리스트에 "릴리스 기준 측정 수치" 항목 포함

### 5.3 측정·모니터링 운영 루프

릴리스 빌드 기준으로 아래 지표를 정기 기록한다.

- 앱 시작 시간(TTI/TTFD)
- 주요 리스트 스크롤 FPS/프레임 드랍
- 화면 전환 지연
- 메모리 사용량(화면 왕복 시 누적 여부)

이슈 대응 순서(고정)

1. 스레드 분류: JS vs UI vs JS-Native
2. 병목 분류: 리스트/상태/이미지/애니메이션/네이티브 호출
3. 최소 수정 적용
4. 릴리스 재측정
5. 수치 개선 확인 후 머지

---

## 팀용 빠른 점검표 (배포 전)

- [ ] 성능 이슈 판정은 릴리스 빌드 기준인가?
- [ ] 대량 리스트에 가상화/메모이제이션/이미지 최적화가 적용됐는가?
- [ ] 전역 상태/Context 과구독이 없는가?
- [ ] 타이머/구독 cleanup 누락이 없는가?
- [ ] JS-Native 고주기 호출을 배치/샘플링했는가?
- [ ] 초기 구동 최적화(lazy loading, side effect 최소화)를 점검했는가?
- [ ] 변경 후 동일 시나리오 재측정으로 개선 수치를 확인했는가?

---

## fit-hub 현재 문제 체크리스트 (2026-02-25 점검)

- [x] (High) `record-history`를 `ScrollView + map`에서 `FlatList`로 전환했는가? (`apps/mobile/app/(protected)/record-history.tsx`)
- [x] (High) 히스토리 카드 렌더를 아이템 컴포넌트로 분리하고 `React.memo`를 적용했는가? (`apps/mobile/app/(protected)/record-history.tsx`)
- [x] (High) `feedback`의 주간 리포트 목록이 데이터 증가를 견딜 수 있게 가상화/아이템 분리를 적용했는가? (`apps/mobile/app/(protected)/feedback.tsx`)
- [x] (Medium) `goals`의 습관 목록 렌더를 리스트 최적화 패턴으로 전환했는가? (`apps/mobile/app/(protected)/goals.tsx`)
- [x] (Medium) mutation 이후 `['dashboard']` 광역 invalidation을 화면/패널 단위로 축소했는가? (`apps/mobile/src/features/*/queries.ts`, `apps/mobile/app/(protected)/record-upload.tsx`)
- [x] (Medium) 업로드/아바타 경로의 이미지 메모리 피크를 줄이기 위해 압축/해상도/품질 정책을 명시했는가? (`apps/mobile/src/features/record/upload-adapter.ts`, `apps/mobile/src/features/profile/service.ts`)
- [ ] (Medium) 로그인 직후 health sync의 실제 체감 영향(시작 시간, 첫 화면 응답)을 릴리스 빌드에서 수치로 검증했는가? (`apps/mobile/app/_layout.tsx`, `apps/mobile/src/features/health/sync-engine.ts`)
- [x] (Checked) startup health sync 계측 이벤트를 추가했는가? (`health.sync.startup.scheduled`, `health.sync.startup.result`, `health.sync.orchestrator.completed.duration_ms`)
- [x] (Checked) 현재 타이머/리스너 cleanup 누수 이슈는 주요 경로에서 확인되지 않았다. (`apps/mobile/src/features/auth/auth-provider.tsx`, `apps/mobile/app/(auth)/callback.tsx`, `apps/mobile/app/(protected)/subscription-callback.tsx`)
