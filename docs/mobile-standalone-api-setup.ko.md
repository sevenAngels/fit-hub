# fit-hub 모바일 단독 운영 API 설정 가이드

작성일: 2026-02-25

## 목표

- `fit-hub` 저장소 단독으로 모바일 앱 + 서버 API를 운영한다.
- 모바일이 호출하는 API를 `apps/api`에서 제공한다.
- AI 경로는 우선 Gemini만 사용한다.

## 서버 앱 위치

- API 서버: `apps/api`
- 주요 엔드포인트:
  - `POST /api/meal/upload`
  - `POST /api/avatar/upload`
  - `GET /api/subscription/status`
  - `POST /api/feedback/generate`
  - `GET /api/feedback/latest`
  - `GET /api/health`

## Vercel 배포

1. Vercel에서 프로젝트 Import
2. Root Directory를 `apps/api`로 지정
3. Framework Preset은 Next.js 사용
4. 환경변수 등록 후 배포

## Vercel 환경변수

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_GEMINI_API_KEY`
- `GEMINI_MODEL_MEAL` (예: `gemini-2.5-flash`)
- `GEMINI_MODEL_FEEDBACK` (예: `gemini-2.5-flash-lite`)
- `GEMINI_HTTP_TIMEOUT_MS` (기본 10000)
- `GEMINI_HTTP_RETRY_ATTEMPTS` (기본 2)
- `GEMINI_MEAL_IMAGE_INLINE_BYTES` (기본 2000000)
- `MEAL_IMAGE_MAX_BYTES` (기본 10485760)
- `AVATAR_IMAGE_MAX_BYTES` (기본 10485760)

## 모바일(.env) 연결

`apps/mobile/.env`에서 아래 값을 서버 배포 주소로 맞춘다.

- `EXPO_PUBLIC_API_BASE_URL=https://<vercel-api-domain>`
- `EXPO_PUBLIC_WEB_BASE_URL=https://<vercel-api-domain>`

## 빠른 점검 순서

1. `GET https://<vercel-api-domain>/api/health` 응답 확인
2. 모바일 로그인 후 기록 업로드(`record-upload`) 테스트
3. 프로필 아바타 업로드 테스트
4. 구독 상태 조회 화면 렌더 확인
