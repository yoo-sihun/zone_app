# ZONE

부위별 스킨케어 기록 + 트러블 원인 성분 추적 앱.

- 얼굴을 5부위(이마/오른볼/왼볼/코/턱)로 나눠 아침/저녁 구분해서 어떤 제품을 어디에 발랐는지 기록
- 트러블이 난 위치와 유형(면포성/구진/화농성/붉은기)을 얼굴 위에 직접 표시
- 트러블 난 부위 vs 안 난 부위(대조군)에 최근 며칠간 발린 성분을 비교해서 의심 성분을 추려줌
- 제품 등록 시 성분표 사진을 찍으면 OpenAI Vision으로 자동 인식(OCR)
- 트러블 표시 시 사진을 찍으면 AI가 유형(면포성/구진/화농성/붉은기)을 추천 (베타, 사용자가 직접 확인/수정 가능)
- 의심 성분을 저장해두면 새 제품 등록 시 자동으로 경고
- 의심 성분을 3일간 빼고 써보는 실험 추적 (전후 트러블 건수 비교)
- 같은 날 같은 부위·시간대에 겹쳐 바른 성분 조합이 상성 경고 대상(AHA/BHA+레티놀 등)이면 기록 즉시 안내
- 수면시간·생리주기 등 외부 요인 수동 기록, 미세먼지(PM2.5)는 에어코리아 API로 자동 조회
- 기간 선택해서 트러블/도포 히스토리/의심 성분/외부 요인 요약 PDF 리포트 생성
- 비밀번호 없는 프로필 선택 방식 — 이메일/비밀번호 로그인은 없고, 프로필만 골라서 각자 기록을 분리해서 씀
- 홈 대시보드(오늘의 피부 날씨, 오늘 바로 추천, 바로가기) + 하단 5탭 네비게이션(홈/기록/분석/화장대/MY)
- 앱 켰을 때 오늘 기록 안 했으면 벨 아이콘에 배지 표시 (브라우저 꺼도 오는 진짜 푸시는 아님)
- 히스토리 화면 — PDF/텍스트가 아니라 **얼굴 위에 직접 시각화**: 기간(7일/30일/전체)별 부위별 도포 빈도(진하기)와 트러블 발생 위치(실제 좌표, 유형별 색)를 같은 얼굴 그림에 겹쳐서 한눈에 대조
- 등록한 제품 이름/성분/카테고리/사진 수정 가능(이전엔 삭제 후 재등록만 가능했음), 지난 실험(진행중/완료/중단) 목록 조회, 프로필 삭제(연쇄 삭제, 되돌리기 불가, 본인 프로필만 가능)
- 제품 등록 시 카테고리(토너/에센스·세럼/크림·로션 등) + 사진(선택, 리사이즈 후 DB에 저장) 같이 등록 가능
- 도포 기록은 큰 부위(이마/오른볼/왼볼/코/턱) 1탭이면 확대 없이 바로 저장, 정밀하게 서브존 단위로 찍고 싶으면 "정밀 도포" 토글로 전환
- 화장대에 없는 제품도 정적 카탈로그(현재 Pith 브랜드 5종)에서 의심 성분 없는 것만 추천, 바로 화장대에 등록 가능
- 여러 부위/제품을 한 번에 저장해도 요청 한 번으로 처리(배치 API)해서 저장이 빠름
- `AI_ENABLED` 환경변수로 OpenAI 호출 전체를 껐다 켤 수 있음(비용 관리용) — 꺼도 핵심 분석 기능은 그대로 동작

위 기능 전부 화면(`frontend/`, React)까지 연동 완료.

## ⚠️ 이 컴퓨터에서 꼭 알아야 할 것

이 PC의 PATH에는 MSYS2(Git Bash)용 Python이 먼저 잡혀 있는데, 이건 `mingw` 빌드라
PyPI의 일반 바이너리 패키지(psycopg2, pydantic 등)가 설치되지 않습니다.
그래서 winget으로 정식 Python 3.12(`python.org` 빌드)를 별도 설치했고,
이 프로젝트의 `.venv`는 반드시 아래 경로의 python으로 만들어야 합니다.

```
C:\Users\ajtwl\AppData\Local\Programs\Python\Python312\python.exe
```

## 실행 방법 (PowerShell)

```powershell
cd C:\Users\ajtwl\zone-app
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --reload
```

이건 백엔드(API 전용)만 띄우는 것 — API 문서(`/docs`)는 기본적으로 꺼져있으니 보려면 `.env`에 `SHOW_DOCS=true`를 추가한 뒤 `http://127.0.0.1:8000/docs`로 접속. 화면(프론트)까지 보려면 별도 터미널에서 `cd frontend && npm install && npm run dev`로 Next.js 개발 서버를 같이 띄워야 함(기본 3000번 포트).

venv가 없다면 새로 생성:

```powershell
C:\Users\ajtwl\AppData\Local\Programs\Python\Python312\python.exe -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 환경변수 (.env)

`.env.example`을 복사해서 `.env`로 만들고 값을 채우세요.

- `OPENAI_API_KEY` — 성분표 OCR/트러블 사진 판단/AI 코멘트·관리팁에 사용 (gpt-4o-mini)
- `AI_ENABLED` — `false`로 두면 위 OpenAI 호출을 전부 스킵(핵심 분석 기능엔 영향 없음). 비워두면 기본값 true(켜짐)
- `SHOW_DOCS` — `true`로 두면 `/docs`(Swagger)·`/redoc`·`/openapi.json`이 열림. 비워두면 기본값 false(꺼짐) — 배포 환경에서 전체 API 목록이 노출되는 걸 막기 위한 기본값이니, 로컬 디버깅 중에만 켜서 쓰기
- `DATABASE_URL` — 비워두면 로컬 sqlite(`zone.db`) 사용. Supabase를 쓰려면
  Supabase 프로젝트의 **Settings → Database → Connection string (URI)** 값을 복사해서
  `postgres://` → `postgresql+psycopg2://` 로 스킴만 바꿔 넣으면 됩니다.
- `AIRKOREA_API_KEY` — 미세먼지(PM2.5) 자동 조회에 사용. [공공데이터포털](https://www.data.go.kr)에서
  "한국환경공단_에어코리아_대기오염정보" 활용신청(무료) 후 발급되는 **인코딩된 서비스키**를 그대로 붙여넣기
  (URL 인코딩된 형태 그대로 써야 함, 다시 인코딩하면 안 됨)
- `AIRKOREA_STATION` — 기준 측정소명, 비워두면 "종로구"(서울)
- `KMA_API_KEY` — 습도 자동 조회(기상청 API Hub 초단기실황조회)에 사용, 순수 영숫자 인증키. 없으면 습도 동기화만 501, 나머지는 정상 동작
- `KMA_NX`/`KMA_NY` — 기상청 격자 좌표, 비워두면 60/127(종로구)
- `KMA_UV_API_KEY` — 자외선지수 자동 조회(공공데이터포털 생활기상지수 조회서비스)에 사용, URL-인코딩된 서비스키(AIRKOREA_API_KEY와 같은 방식, KMA_API_KEY와는 다른 포털·다른 인코딩). 없으면 자외선지수만 null로 채워지고 습도는 정상
- `KMA_AREA_NO` — 생활기상지수 지점코드, 비워두면 1100000000(서울)

## 구조

프론트(`frontend/`)와 백엔드(`backend/`)가 완전히 분리된 두 서비스입니다 — 프론트는 Vercel에
정적 사이트로, 백엔드는 Render에 API 서버로 각각 배포됩니다.

```
frontend/               React/Next.js (Vercel용, 아래 "배포 (Vercel, React 프론트)" 참고)
  app/page.js            메인 화면 (홈/기록/분석/화장대/MY 5탭 전환)
  app/layout.js           루트 레이아웃, globals.css/Pretendard 폰트 로드
  app/globals.css         스타일시트
  lib/api.js              API_BASE + api() fetch 헬퍼
  lib/AppContext.js         전역 상태/액션 (프로필, 화면전환, 얼굴 줌, 제품/기록/분석/실험 등 대부분의 로직)
  components/              화면·모달 컴포넌트
  next.config.mjs          output: 'export' (정적 내보내기)

backend/
  main.py            FastAPI 앱 (API 전용, HTML 서빙 없음), CORS 미들웨어, /api/analysis
  database.py        SQLAlchemy 엔진 (DATABASE_URL 없으면 sqlite 폴백)
  deps.py             X-Profile-Id 헤더 검증 (로그인 대체)
  models.py          Profile / Product / DailyLog / TroubleDot / SuspectIngredient / Experiment / ExternalFactor
  schemas.py         Pydantic 요청/응답 모델
  analysis.py         트러블-성분 대조 분석 로직
  experiments.py       3일 실험 로직 (잠금 판정, 전후 비교 계산)
  interactions.py       성분 조합 상성 정적 테이블
  catalog.py             외부 카탈로그 제품 정적 리스트 (현재 Pith 브랜드 5종)
  airkorea.py            에어코리아 미세먼지(PM2.5) API 연동
  weather.py             기상청 API Hub 초단기실황조회(습도) + 공공데이터포털 생활기상지수(자외선지수) 연동, 둘 다 오늘 날짜만 지원
  reports.py             PDF 리포트 생성 (reportlab)
  fonts/NanumSquareR.ttf  PDF용 한글 폰트 (SIL OFL)
  routers/
    profiles.py          /api/profiles (프로필 목록/생성/삭제 — 삭제는 본인 프로필만 가능)
    products.py       /api/products (CRUD), /api/products/ocr, /api/products/recommended
    logs.py            /api/day/{date}, /api/today-status, /api/log/toggle(-batch), /api/dots 등
    suspects.py         /api/suspects (CRUD)
    experiments.py       /api/experiments (시작/조회/결과/중단)
    external_factors.py   /api/external-factors (수면/생리주기/메모/미세먼지·습도·자외선 동기화)
    reports.py             /api/reports/pdf
    history.py             /api/history/summary, /api/history/zone-status (히스토리 화면 얼굴 시각화 집계 + 리포트용 부위별 상태/AI 팁)
    catalog.py              /api/catalog/recommended

ai/
  client.py           OpenAI 클라이언트 생성 공용 함수, AI_ENABLED 환경변수 확인
  ocr.py             OpenAI Vision으로 성분표 사진 → 성분 리스트 추출
  trouble_classify.py  OpenAI Vision으로 트러블 사진 → 유형 추천 (베타)
  rank_suspects.py       텍스트 전용 GPT로 의심 성분 순위 재정렬 (실패 시 빈도순 폴백)
  zone_tips.py             텍스트 전용 GPT로 부위별 관리팁 생성 (실패 시 고정 문구 폴백)

render.yaml           Render 배포 설정 (Blueprint)
```

## 배포 (Render — 백엔드, 지금 실배포 중)

`render.yaml`에 배포 설정이 있음 (Blueprint로 자동 인식됨).

1. 이 리포를 GitHub에 push
2. [Render 대시보드](https://dashboard.render.com) → New → Blueprint → 방금 push한 리포 선택
3. 환경변수 입력 요구됨:
   - `OPENAI_API_KEY`
   - `AI_ENABLED` — 기본값 `true`. OpenAI 비용이 걱정되면 `false`로 두면 핵심 기능은 그대로 두고 AI 호출만 꺼짐
   - `SHOW_DOCS` — 기본값 `false`(꺼짐). `/docs` 같은 API 스키마 전체 노출을 막기 위한 기본값이라 보통 안 건드려도 됨
   - `DATABASE_URL` — **꼭 채울 것.** 비워두면 sqlite로 동작하는데, Render 무료 플랜은 디스크가
     휘발성이라 재배포/재시작마다 데이터가 사라짐. Supabase 프로젝트 만들고 **Settings → Database →
     Connection string (URI)** 값을 복사해서 `postgres://` → `postgresql+psycopg2://`로 스킴만 바꿔 넣기.
   - `AIRKOREA_API_KEY` — 없으면 미세먼지 동기화(`/api/external-factors/{date}/sync-pm25`)만 안 될 뿐 나머지는 정상 동작
   - `KMA_API_KEY`/`KMA_UV_API_KEY` — 없으면 습도/자외선 동기화만 안 될 뿐 나머지는 정상 동작
   - `CORS_ORIGINS` — 프론트(Vercel)의 도메인(`https://xxx.vercel.app`)을 콤마로 넣기. 비워두면 모든 오리진 허용(`*`, 기본값)
4. 배포되면 `https://<서비스명>.onrender.com`으로 접속 가능. 지금 실제 배포 URL: `https://zone-app-9iiw.onrender.com`. `/health`가 헬스체크 엔드포인트.

무료 플랜은 idle 후 첫 요청이 느림(수십 초 콜드 스타트) — 데모 직전에 한 번 미리 요청 보내서 깨워두기.

## 배포 (Vercel, React 프론트)

백엔드(FastAPI)는 Render에, `frontend/`(React/Next.js, 정적 내보내기 모드)는 Vercel에 배포함. 부위 목록 같은 상수 값은 빌드 시점이 아니라 페이지 로드 시 `GET /api/config`를 fetch해서 채움.

1. [Vercel 대시보드](https://vercel.com) → New Project → 이 리포 선택
2. **Root Directory를 `frontend`로 설정** (레포 루트가 아님)
3. Framework Preset은 Next.js가 자동 인식됨 (`next.config.mjs`의 `output: 'export'`로 정적 빌드)
4. 환경변수 `NEXT_PUBLIC_API_BASE`를 Render 백엔드 URL로 설정 (`https://zone-app-9iiw.onrender.com`) — 비워두면 `frontend/lib/api.js`에 하드코딩된 같은 값이 기본으로 쓰임
5. 배포되면 `https://<프로젝트명>.vercel.app`으로 접속 가능. 지금 실제 배포 URL: `https://zone-app-six.vercel.app`
6. 배포 후 Render 쪽 `CORS_ORIGINS` 환경변수에 이 Vercel 도메인 추가 (선택 사항 — 기본값 `*`라 안 해도 동작은 함)

로컬에서 띄우려면: `cd frontend && npm install && npm run dev` (기본 3000번 포트). 로컬 백엔드를 가리키게 하려면 `frontend/.env.local`에 `NEXT_PUBLIC_API_BASE=http://localhost:<백엔드 포트>` 추가 (Next.js 개발 서버는 `localhost`로 접속해야 함 — `127.0.0.1`로 접속하면 dev 서버의 cross-origin 보호에 막힘). `.env.local`은 gitignore돼있어서 로컬에만 남음.

## 참고

- 이메일/비밀번호 로그인 없음 — 대신 프로필 선택 방식(`X-Profile-Id` 헤더). 진짜 보안은 아니고, 여러 명이 기록을 안 섞고 쓰는 용도. 다만 프로필 삭제(`DELETE /api/profiles/{id}`)만은 헤더가 그 id와 일치해야 하도록 막아뒀음(누구나 아무 프로필이나 지울 수 있는 걸 막기 위함)
- `/docs`(Swagger)는 기본적으로 꺼져있음(`SHOW_DOCS=true`로 로컬에서만 켜서 씀) — 배포 환경에서 전체 API 목록이 노출되는 걸 막기 위함
- 성분표/트러블 사진은 저장하지 않고 OpenAI에 전달해 결과만 추출한 뒤 버림 (Storage 불필요)
- 분석 로직의 `LAG_DAYS`(기본 3일)는 `backend/analysis.py`에서 조정 가능
- **`openai` 패키지 버전 낮추지 말 것.** `1.51.0` 같은 구버전은 최신 `httpx`(0.28+)와 안 맞아서
  `OpenAI()` 클라이언트를 만드는 순간 `TypeError: unexpected keyword argument 'proxies'`로 죽음.
  실제로 겪은 문제라 `openai==1.59.9`로 고정해둠(OCR/AI 유형 판단 둘 다 이 문제로 원래 안 되고 있었음).
