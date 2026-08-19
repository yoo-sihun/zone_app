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
- 로그인/계정 없음 — 단일 사용자 기준(해커톤 스코프)

위 기능 전부 화면(`frontend/`)까지 연동 완료 — 지금 UI는 임시 디자인이고, 팀 프론트 담당자의 피그마 디자인이 나오면 교체될 예정입니다.

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

브라우저에서 http://127.0.0.1:8000 접속.

venv가 없다면 새로 생성:

```powershell
C:\Users\ajtwl\AppData\Local\Programs\Python\Python312\python.exe -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 환경변수 (.env)

`.env.example`을 복사해서 `.env`로 만들고 값을 채우세요.

- `OPENAI_API_KEY` — 성분표 OCR에 사용 (gpt-4o-mini vision)
- `DATABASE_URL` — 비워두면 로컬 sqlite(`zone.db`) 사용. Supabase를 쓰려면
  Supabase 프로젝트의 **Settings → Database → Connection string (URI)** 값을 복사해서
  `postgres://` → `postgresql+psycopg2://` 로 스킴만 바꿔 넣으면 됩니다.
- `AIRKOREA_API_KEY` — 미세먼지(PM2.5) 자동 조회에 사용. [공공데이터포털](https://www.data.go.kr)에서
  "한국환경공단_에어코리아_대기오염정보" 활용신청(무료) 후 발급되는 **인코딩된 서비스키**를 그대로 붙여넣기
  (URL 인코딩된 형태 그대로 써야 함, 다시 인코딩하면 안 됨)
- `AIRKOREA_STATION` — 기준 측정소명, 비워두면 "종로구"(서울)

## 구조

팀 분업(프론트/백엔드/AI) 기준으로 폴더를 나눴습니다. 배포는 여전히 FastAPI 하나가
프론트 파일까지 서빙하는 단일 서비스(Render)입니다 — 폴더만 분리했을 뿐 별도 서버는 아닙니다.

```
frontend/
  templates/          login 없이 index.html (Jinja2) 하나
  static/             css/js (바닐라 JS)

backend/
  main.py            FastAPI 앱, 페이지 라우트(/), frontend/ 정적 서빙, /api/analysis
  database.py        SQLAlchemy 엔진 (DATABASE_URL 없으면 sqlite 폴백)
  models.py          Product / DailyLog / TroubleDot / SuspectIngredient / Experiment / ExternalFactor
  schemas.py         Pydantic 요청/응답 모델
  analysis.py         트러블-성분 대조 분석 로직
  experiments.py       3일 실험 로직 (잠금 판정, 전후 비교 계산)
  interactions.py       성분 조합 상성 정적 테이블
  airkorea.py            에어코리아 미세먼지(PM2.5) API 연동
  reports.py             PDF 리포트 생성 (reportlab)
  fonts/NanumSquareR.ttf  PDF용 한글 폰트 (SIL OFL)
  routers/
    products.py       /api/products (CRUD), /api/products/ocr
    logs.py            /api/day/{date}, /api/log/toggle, /api/dots 등
    suspects.py         /api/suspects (CRUD)
    experiments.py       /api/experiments (시작/조회/결과/중단)
    external_factors.py   /api/external-factors (수면/생리주기/메모/미세먼지 동기화)
    reports.py             /api/reports/pdf

ai/
  client.py           OpenAI 클라이언트 생성 공용 함수
  ocr.py             OpenAI Vision으로 성분표 사진 → 성분 리스트 추출
  trouble_classify.py  OpenAI Vision으로 트러블 사진 → 유형 추천 (베타)

render.yaml           Render 배포 설정 (Blueprint)
```

## 배포 (Render)

`render.yaml`에 배포 설정이 있음 (Blueprint로 자동 인식됨).

1. 이 리포를 GitHub에 push
2. [Render 대시보드](https://dashboard.render.com) → New → Blueprint → 방금 push한 리포 선택
3. 환경변수 입력 요구됨:
   - `OPENAI_API_KEY`
   - `DATABASE_URL` — **꼭 채울 것.** 비워두면 sqlite로 동작하는데, Render 무료 플랜은 디스크가
     휘발성이라 재배포/재시작마다 데이터가 사라짐. Supabase 프로젝트 만들고 **Settings → Database →
     Connection string (URI)** 값을 복사해서 `postgres://` → `postgresql+psycopg2://`로 스킴만 바꿔 넣기.
   - `AIRKOREA_API_KEY` — 없으면 미세먼지 동기화(`/api/external-factors/{date}/sync-pm25`)만 안 될 뿐 나머지는 정상 동작
4. 배포되면 `https://<서비스명>.onrender.com`으로 접속 가능. `/health`가 헬스체크 엔드포인트.

무료 플랜은 idle 후 첫 요청이 느림(수십 초 콜드 스타트) — 데모 직전에 한 번 미리 요청 보내서 깨워두기.

## 참고

- 로그인/회원가입 없음 — 모든 데이터는 사용자 구분 없이 전역으로 저장됨(해커톤 데모용, 단일 사용자 전제)
- 성분표/트러블 사진은 저장하지 않고 OpenAI에 전달해 결과만 추출한 뒤 버림 (Storage 불필요)
- 분석 로직의 `LAG_DAYS`(기본 3일)는 `backend/analysis.py`에서 조정 가능
- **`openai` 패키지 버전 낮추지 말 것.** `1.51.0` 같은 구버전은 최신 `httpx`(0.28+)와 안 맞아서
  `OpenAI()` 클라이언트를 만드는 순간 `TypeError: unexpected keyword argument 'proxies'`로 죽음.
  실제로 겪은 문제라 `openai==1.59.9`로 고정해둠(OCR/AI 유형 판단 둘 다 이 문제로 원래 안 되고 있었음).
