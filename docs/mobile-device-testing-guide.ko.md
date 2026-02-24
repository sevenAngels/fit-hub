# 모바일 디바이스 테스트 및 빌드 가이드

날짜: 2026-02-23

## 범위

- 목적: 모바일 작업(특히 T25 HealthKit 권한 흐름 포함)에 대해 실제 디바이스 검증을 수행합니다.
- 이 가이드는 로컬 저장소 경로가 `fit-hub`라고 가정합니다.

## 사전 준비

1. Node 20.19.4+ 설치
2. Expo 계정 및 EAS 로그인 완료
3. iOS 실기기 + Apple Developer 계정(HealthKit 테스트용)
4. `apps/mobile/.env.example`를 기반으로 `apps/mobile/.env` 구성 완료
5. Apple 서명 프로필/Xcode 타겟에서 iOS HealthKit Capability 활성화

## 실기기 테스트 전 반드시 수행할 작업

아래 체크리스트를 순서대로 진행하세요. 한 단계라도 실패하면 다음으로 넘어가지 말고 먼저 수정하세요.

1. `apps/mobile/.env`에 모바일 앱 환경값 입력:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_API_BASE_URL`
   - `EXPO_PUBLIC_WEB_BASE_URL`
   - health 플래그는 테스트 범위에 맞게 유지
2. 런타임 스크립트 체크(T19/T20) 전에 셸 환경변수 export:
   - T19 최소 런타임: `T19_SUPABASE_URL`, `T19_SUPABASE_ANON_KEY`, `T19_USER_A_ACCESS_TOKEN`
   - T19 전체 커버리지 권장: `T19_USER_A_ID`, `T19_USER_B_ACCESS_TOKEN`, `T19_USER_B_ID`, `T19_REVOKED_ACCESS_TOKEN`
   - T20 런타임 모드: `E2E_RUNTIME=true` (필요 시 디바이스 전용 변수 추가)
3. 로컬 머신에서 EAS 로그인 확인:
   - `npx eas whoami`
   - 로그인 안 되어 있으면: `npx eas login`
4. 빌드 전에 로컬 기준 명령이 모두 통과하는지 확인:
   - `npm ci`
   - `npm run typecheck --workspace apps/mobile`
   - `npm run lint --workspace apps/mobile`
   - `npm run test:run --workspace apps/mobile`
5. 타겟 디바이스(iOS/Android)에 Dev Client 빌드 설치 후 Metro 연결
6. 아래 수동 앱 플로우 체크리스트 실행, 실패 케이스는 스크린샷/영상 확보
7. 수동 테스트 이후 evidence 스크립트 재실행 및 태스크 evidence 파일 갱신

## 설치 및 베이스라인 점검

1. 의존성 설치:
   - `npm ci`
2. 베이스라인 검증 실행:
   - `npm run typecheck --workspace apps/mobile`
   - `npm run lint --workspace apps/mobile`
   - `npm run test:run --workspace apps/mobile`

## iOS 실기기 실행(Dev Client)

1. iOS Dev Client 빌드:
   - `npx eas build --platform ios --profile development --non-interactive`
2. 기기에 빌드 설치:
   - CLI 출력의 EAS 빌드 페이지 URL을 iPhone에서 열기
   - EAS가 안내한 TestFlight/내부 배포 경로로 앱 설치
3. Dev Client용 Metro 시작:
   - `npm --prefix apps/mobile run start -- --dev-client`
4. 기기에서 설치된 Dev Client 앱 실행 후 실행 중인 Metro 서버에 연결

## Android 실기기 실행(Dev Client)

1. Android Dev Client 빌드:
   - `npx eas build --platform android --profile development --non-interactive`
2. EAS 빌드 산출물(APK/AAB) 설치
3. Dev Client용 Metro 시작:
   - `npm --prefix apps/mobile run start -- --dev-client`
4. 기기에서 앱 실행 후 Metro 연결

## F1 이전 수동 기능 체크리스트 (초점: T1-T23)

앱 설치 후 UI에서 아래 항목을 실행하고 각 항목의 pass/fail을 기록하세요.

1. 인증 및 가드 흐름:
   - 비인증 접근 시 로그인 화면으로 리다이렉트
   - 로그인 성공 후 보호 라우트 접근 가능
   - 로그아웃 시 비인증 상태로 복귀
2. 온보딩 및 라우팅:
   - 온보딩 단계 진행이 끝까지 동작
   - 온보딩 중단 후 앱 재진입 시 정상 복구
3. 기록(Record) 파이프라인:
   - 기록 업로드 화면 진입 가능
   - 이미지 선택/카메라 경로 동작(권한 + 선택)
   - 업로드 진행률과 결과 상태가 크래시 없이 표시
4. 핵심 기능 화면:
   - 대시보드 렌더링
   - 목표/습관 화면 렌더링 및 상호작용 응답
   - 기분(Mood) 화면 렌더링 및 저장 경로 동작
   - 프로필/아바타 화면 렌더링 및 업데이트 경로 도달 가능
   - 리포트 화면 오픈 및 주간 리포트 흐름 도달 가능
5. 구독/릴리스 폴백 경로:
   - 구독 화면 폴백 상태 렌더링, 핵심 화면 차단 없음
   - 구독 폴백 조건에서도 dashboard/report/mood 이동 정상

## 디바이스 세션 종료 전 반드시 실행할 런타임 스크립트

1. T19 보안 스모크:
   - dry-run: `npm run test:security:rls:dry-run`
   - runtime(환경변수 필요): `npm run test:security:rls`
2. T20 E2E 코어 스위트:
   - dry-run: `npm run test:e2e:core:dry-run`
   - runtime: `npm run test:e2e:core`
3. T21/T22/T23 보조 체크:
   - `npm run test:observability`
   - `npm run test:subscription:fallback`
   - `npm run test:release:beta`

## T25 iOS HealthKit 테스트 절차

1. 로그인 후 대시보드 진입
2. `Open health connect`로 이동
3. 허용(Grant) 경로:
   - 상태가 `notDetermined`이면 `Connect HealthKit` 탭
   - Steps + Active Calories 읽기 권한 허용
   - 상태가 `Connected`로 변경되는지 확인
4. 거부/철회 경로:
   - iOS 설정/Health에서 권한 철회
   - 앱 복귀 후 폴백 문구 + `Open iOS Settings` CTA 확인
5. 시작 차단 없음 확인:
   - 앱 재실행 후 HealthKit 권한 팝업이 시작을 막지 않고 auth/onboarding/dashboard 렌더링되는지 확인

## 디바이스 테스트 후 Evidence 업데이트 명령

1. 정적 계약 증적 재생성:
   - `npm run test:healthkit:permission`
2. 런타임 산출물을 확보했다면 수동으로 태스크 증적 문서 갱신:
   - `.sisyphus/evidence/task-25-healthkit-permission.md`
   - `.sisyphus/evidence/task-25-healthkit-permission.json`
   - `.sisyphus/evidence/task-25-healthkit-permission-error.json`

## 문제 해결

- HealthKit 권한 팝업이 보이지 않을 때:
  - iOS 기기 빌드가 Expo Go가 아닌 dev/release 빌드인지 확인
  - 앱 식별자에 HealthKit Capability가 활성화되어 있는지 확인
- 앱이 Metro에 연결되지 않을 때:
  - 디바이스와 개발 머신의 네트워크 연결 가능 여부 확인
  - Metro 재시작: `npm --prefix apps/mobile run start -- --dev-client --clear`
