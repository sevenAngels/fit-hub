# Expo Tunnel 외부 원격 테스트 가이드

작성일: 2026-02-25

## 목적

- 맥과 아이폰이 같은 네트워크가 아니어도(`맥: Wi-Fi`, `아이폰: 셀룰러`) 모바일 앱을 테스트한다.

## 사전 조건

1. `apps/mobile/.env` 설정 완료
   - `EXPO_PUBLIC_API_BASE_URL=https://fit-hub-bay.vercel.app`
   - `EXPO_PUBLIC_WEB_BASE_URL=https://fit-hub-bay.vercel.app`
   - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`도 정상 입력
2. 아이폰에 Expo Go 설치 완료
3. 맥에서 프로젝트 의존성 설치 완료

## 실행 절차 (외부 원격)

1. 프로젝트 루트에서 의존성 설치
   - `npm ci`
2. Expo Tunnel 시작
   - `npm --prefix apps/mobile run start -- --tunnel`
3. 터미널에 표시된 QR 코드/링크 확인
4. 아이폰(셀룰러)에서 Expo Go 실행
5. QR 스캔 또는 링크로 프로젝트 열기

## 권장 테스트 시나리오

1. 로그인
2. 식단 이미지 업로드
3. 아바타 업로드
4. 피드백 생성

## 장애 대응

- Expo Go에서 프로젝트가 안 열리면
  1. 터널 재시작: `npm --prefix apps/mobile run start -- --tunnel --clear`
  2. Expo Go 강제 종료 후 재실행
- API 호출 실패가 나면
  1. `EXPO_PUBLIC_API_BASE_URL` 오타 확인
  2. `https://fit-hub-bay.vercel.app/api/health`가 200인지 확인
- 인증 관련 오류가 나면
  1. `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` 재확인

## 참고

- 이 방식은 실제 "외부 네트워크 원격 테스트"와 거의 동일한 조건을 재현한다.
- 현재 단계에서는 HealthKit 테스트를 제외하고 핵심 플로우 위주로 검증한다.

## 종료

종료 방법 정리:
- 현재 실행 중인 터미널에서: Ctrl + C
- 백그라운드/어느 터미널인지 모를 때:
  1) PID 확인  
     lsof -nP -iTCP:8081 -sTCP:LISTEN
  2) 종료  
     kill -TERM <PID>  
     (안 죽으면 kill -KILL <PID>)
다시 시작은 이걸로:
npm --prefix apps/mobile run start -- --tunnel --port 8082