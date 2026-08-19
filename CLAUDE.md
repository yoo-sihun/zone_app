# ZONE — 부위별 스킨케어 원인 분석 서비스

## 프로젝트 개요
얼굴을 5개 부위(이마/오른볼/왼볼/코/턱·입주변)로 나눠 도포 제품과 트러블 발생 위치를 기록하고,
**트러블 난 부위 vs 안 난 부위를 대조군으로 삼아** 원인 성분을 역추적하는 서비스. 해커톤 제출용 프로젝트.

**실제 스택** (계획 문서가 아니라 지금 리포에 있는 그대로):
- 백엔드: FastAPI, SQLAlchemy ORM
- DB: `DATABASE_URL` 환경변수가 없으면 로컬 sqlite(`zone.db`) 자동 사용. 지정하면 아무 Postgres(Supabase 포함)든 연결 가능 — 하지만 Supabase Auth/Storage/RLS는 안 씀, 순수 커넥션 문자열로만 사용.
- 인증: **없음.** 로그인/회원가입 기능 자체를 제거함 — 모든 데이터는 사용자 구분 없이 전역으로 저장되는 단일 사용자 앱. `users` 테이블도 없음.
- 프론트: FastAPI가 Jinja2 템플릿을 직접 서빙(`frontend/templates`) + 바닐라 JS(`frontend/static`). 별도 Vercel/Next.js 없음.
- OCR: OpenAI Vision(`gpt-4o-mini`, JSON 응답 모드)으로 성분표 사진 → 성분 리스트. `ai/ocr.py`.
- 배포: Render 단일 서비스 (`render.yaml`).

실행법·환경변수는 [README.md](README.md) 참고.

**폴더 구조**: 팀 분업(프론트/백엔드/AI) 기준으로 `frontend/` `backend/` `ai/` 세 폴더로 나눠져 있지만, 이건 코드 위치만 나눈 것이고 **배포되는 앱은 여전히 하나**임 — `backend/main.py`의 FastAPI가 `frontend/`의 템플릿·정적 파일을 직접 서빙하고, `backend/routers/products.py`가 `ai/ocr.py`를 import해서 씀. 별도 서버로 쪼개져 있지 않으므로 "프론트 따로 배포"같은 걸 시도하면 안 됨.

---

## 0. 핵심 분석 로직 (실제 구현, [backend/analysis.py](backend/analysis.py))
- `analyze(db)`:
  1. `trouble_dots`에서 등장한 부위를 `bad_zones`, 나머지 4부위 중 남은 걸 `good_zones`로 나눔
  2. 각 트러블 발생일마다 해당 부위에 `LAG_DAYS`(기본 3일) 이내 발린 제품들의 성분을 집계(`hits`)
  3. `good_zones`에도 쓰인 성분(`safe`)은 의심 목록에서 제외
  4. 남은 성분을 사용 빈도순으로 정렬해 `suspects`로 반환
  5. 응답에 상황별 안내 문구(`message`)도 같이 반환 — 트러블 기록 없음 / 대조군(안 난 부위) 없음 / 겹치는 성분 없음 / 기록 기간이 `LAG_DAYS`보다 짧음 / 정상적으로 N일치 분석함, 5가지 상태를 서버에서 판단해서 문자열로 내려줌. 프론트는 이 문구를 그대로 표시하면 되고, "데이터 충분한지" 판단 로직을 프론트에서 다시 만들 필요 없음.
- 아직 없는 것: 자외선 자동 연동(기상청 API 별도 필요, 미세먼지와 다른 기관), 바코드 스캔 — §5 "향후 아이디어" 참고.

**AM/PM 구분 + 트러블 유형**은 구현됨:
- `daily_logs.time_slot`(`am`/`pm`)로 도포 시간대 구분. `analyze()`의 `suspects`에 `time_slots` 필드가 붙어서, 어떤 성분이 아침에만/저녁에만/둘 다 발렸는지 알 수 있음 (매칭 로직 자체는 시간대로 거르지 않고, 정보만 부가).
- `trouble_dots.type`(`comedonal`/`papule`/`pustule`/`redness`)로 트러블 유형 구분. `GET /api/analysis?type=pustule`처럼 쿼리 파라미터로 특정 유형만 필터링해서 분석 가능(생략하면 전체).

**의심 성분 저장 + 3일 실험 추적** ([backend/experiments.py](backend/experiments.py))은 구현됨:
- `POST /api/suspects {ingredient}`로 저장해두면, 이후 `POST /api/products`로 등록하는 제품에 그 성분이 있으면 응답의 `warnings`에 표시됨
- `POST /api/experiments {ingredient}`로 3일(`EXPERIMENT_DAYS`) 실험 시작 — 시작일부터 `EXPERIMENT_DAYS - 1`일 뒤까지, 그 성분이 든 제품은 `GET /api/products` 응답에서 `locked: true`로 표시되고, `POST /api/log/toggle`로 새로 바르려 하면 400 에러로 막힘 (이미 기록된 건 삭제는 가능)
- `GET /api/experiments/{id}/result`에서 실험 시작 전 3일 vs 진행 3일의 `trouble_dots` 건수를 비교 (`before_count`/`during_count`/`improved`). 3일이 지난 뒤 이 엔드포인트를 호출하면 그 시점에 `status`가 `completed`로 바뀜(자동 배치 없음, 조회 시점에 확정).
- **프론트는 아직 이 API들을 안 씀** — 프론트 담당이 피그마 디자인 완성 후 연동 예정. 지금은 백엔드 로직/스키마만 있고 UI 연결 없음.

**성분 조합 상성 경고** ([backend/interactions.py](backend/interactions.py))도 구현됨:
- DB 테이블이 아니라 코드에 하드코딩된 정적 리스트(`INGREDIENT_INTERACTIONS`) — 관리자가 수시로 바꿀 데이터가 아니라서 굳이 테이블로 뺄 필요 없다고 판단함. 조합 늘리려면 이 파일에 딕셔너리만 추가하면 됨.
- `POST /api/log/toggle`로 제품을 추가하는 순간, **같은 날짜+부위+시간대**에 이미 발린 다른 제품들과의 성분 조합을 체크해서 응답의 `warnings`에 담아 반환 (매칭되는 게 없으면 빈 배열)
- 시간대(`time_slot`)까지 일치해야 체크 대상이 됨 — 아침에 바른 성분과 저녁에 바른 성분은 실제로 섞인 적이 없으므로 상성 경고 대상에서 제외

**외부 변수(수동 입력 + 미세먼지 자동 동기화) + PDF 리포트**도 구현됨:
- `external_factors` 테이블(날짜당 1행): `POST /api/external-factors {date, sleep_hours?, menstrual_phase?, memo?}`로 upsert, `GET /api/external-factors/{date}`로 조회(없으면 null).
- 미세먼지(PM2.5)는 [backend/airkorea.py](backend/airkorea.py)로 에어코리아 공공API 연동해서 자동 조회 가능: `POST /api/external-factors/{date}/sync-pm25` 호출하면 그 날짜의 PM2.5 시간별 평균을 가져와 `external_factors.pm25`에 저장(기존 sleep_hours/memo 등은 그대로 유지, pm25만 갱신). 자동 배치 없음 — 호출해야 채워짐. 기준 측정소는 `AIRKOREA_STATION` 환경변수(기본값 "종로구"=서울), 인증키는 `AIRKOREA_API_KEY`(data.go.kr에서 발급받은 **URL-인코딩된** 값 그대로 넣어야 함 — 다시 인코딩하면 깨짐).
- 자외선(UV)은 에어코리아가 아니라 기상청 API라 별도 연동 필요, 아직 없음.
- `GET /api/reports/pdf?start=&end=`가 그 기간의 트러블 발생 현황(날짜·부위·유형 표) + 도포 제품 히스토리(날짜·시간대·부위·제품명 표) + 저장된 의심 성분 목록을 한 장짜리 PDF로 만들어 바로 다운로드(`StreamingResponse`, `application/pdf`)로 반환. 상태 폴링(pending/ready) 같은 거 없이 요청-응답 안에서 동기 생성 — 리포트 만드는 데이터양이 해커톤 스코프에서 그 정도로 크지 않다고 판단.
- **한글 폰트 이슈 주의**: `reportlab`으로 한글을 그릴 때 `UnicodeCIDFont`(예: `HYGothic-Medium`)는 글리프를 PDF에 임베드하지 않고 뷰어가 시스템에 깔린 한글 폰트로 대체 렌더링하는 방식이라, 뷰어에 맞는 폰트가 없으면 빈 칸으로 나옴(실제로 이 문제를 겪고 확인함). 그래서 [backend/fonts/NanumSquareR.ttf](backend/fonts/NanumSquareR.ttf)(네이버 나눔스퀘어, SIL OFL 라이선스, 재배포 허용)를 리포에 직접 넣고 `TTFont`로 통째로 임베드하는 방식을 씀([backend/reports.py](backend/reports.py)) — 이러면 뷰어 환경과 무관하게 항상 제대로 보임. 폰트 파일을 지우거나 바꾸면 리포트가 다시 깨지니 주의.

---

## 1. 실제 데이터 모델 ([backend/models.py](backend/models.py))

```
products
  id, name,
  ingredients JSON  -- 문자열 리스트, 별도 ingredients 테이블 없음

daily_logs             -- "이 날 이 부위/시간대에 이 제품을 발랐다"
  id, date, zone, time_slot(am|pm), product_id
  unique(date, zone, product_id, time_slot)

trouble_dots            -- 트러블 위치 마킹
  id, date, zone, type(comedonal|papule|pustule|redness), x, y

suspect_ingredients      -- 사용자가 저장해둔 의심 성분
  id, ingredient (unique), created_at

experiments              -- 3일 성분 제외 실험
  id, ingredient, start_date, status(active|completed|stopped), created_at

external_factors         -- 날짜당 1행, 수동 입력 + 미세먼지 자동 동기화
  id, date (unique), sleep_hours, menstrual_phase, memo, pm25
```

사용자 구분 컬럼(`user_id`) 없음 — 전역 데이터. `ZONES = [forehead, rcheek, lcheek, nose, chin]` (모델 상단 상수).
인덱스: `daily_logs.date`, `trouble_dots.date`에 index=True.

---

## 2. 실제 API 엔드포인트

```
GET    /api/products             → [{id, name, ingredients, locked}]  -- locked는 진행 중인 실험 대상 성분 포함 시 true
POST   /api/products            {name, ingredients: [str]} → {..., warnings: [str]}  -- 의심 성분 겹치면 warnings에 표시
DELETE /api/products/{id}
POST   /api/products/ocr        (multipart image) → {name, ingredients}

GET    /api/day/{date}          → {date, log: {zone: {am:[product_id], pm:[product_id]}}, dots: [{id,zone,type,x,y}]}
POST   /api/log/toggle          {date, zone, time_slot, product_id} → {applied, warnings}  -- 있으면 삭제(warnings 없음), 없으면 추가하고 같은 날짜/부위/시간대 성분 조합 상성 경고 반환. 실험 중인 성분이 든 제품을 새로 추가하려 하면 400
POST   /api/log/copy-previous?day=  -- 전날 기록을 오늘로 복사 (time_slot 포함) → {ok, skipped: [제품명], warnings}. 실험 중인 성분이 든 제품은 복사에서 자동 제외되고 skipped에 표시됨, 나머지에 대해 성분 상성 체크도 toggle과 동일하게 수행
DELETE /api/log/{date}

POST   /api/dots                {date, zone, type, x, y}
DELETE /api/dots/{id}

GET    /api/analysis            → analyze() 결과. ?type=comedonal|papule|pustule|redness 로 특정 트러블 유형만 필터링 가능. suspects 각 항목에 time_slots 필드 포함, 응답에 상황별 안내 message 필드 포함

GET    /api/suspects            → [{id, ingredient}]
POST   /api/suspects            {ingredient} -- 이미 있으면 그냥 기존 것 반환(idempotent)
DELETE /api/suspects/{id}

GET    /api/experiments/active  → 진행 중인 실험 1건 또는 null
POST   /api/experiments         {ingredient} → 실험 시작 (이미 active면 400)
GET    /api/experiments/{id}/result → {..., before_count, during_count, improved}
PATCH  /api/experiments/{id}    → 중단(status=stopped)

POST   /api/external-factors    {date, sleep_hours?, menstrual_phase?, memo?} -- upsert (pm25는 건드리지 않음)
GET    /api/external-factors/{date} → 값 또는 null
POST   /api/external-factors/{date}/sync-pm25 → 에어코리아에서 그 날짜 PM2.5 평균 가져와 저장

GET    /api/reports/pdf?start=&end= → PDF 파일 스트리밍 다운로드 (기간 내 트러블/도포 히스토리/의심 성분/외부 요인 요약)
```

인증 없음 — 모든 엔드포인트가 누구나 호출 가능. `/`가 유일한 페이지 라우트.

---

## 3. 파일 구조

```
frontend/
  templates/          index.html (Jinja2) — 로그인 페이지 없음
  static/             css/js

backend/
  main.py            FastAPI 앱, 페이지 라우트(/), frontend/ 정적 서빙, /api/analysis
  database.py        SQLAlchemy 엔진 (DATABASE_URL 없으면 sqlite 폴백)
  models.py          Product / DailyLog / TroubleDot / SuspectIngredient / Experiment / ExternalFactor, ZONES 상수
  schemas.py         Pydantic 요청/응답 모델
  analysis.py         트러블-성분 대조 분석 (LAG_DAYS=3)
  experiments.py       3일 실험 관련 로직 (잠금 판정, 결과 계산) — analysis.py와 별개 모듈
  interactions.py       성분 조합 상성 정적 테이블 + 체크 함수
  airkorea.py            에어코리아 미세먼지 API 호출 (PM2.5 일평균 계산)
  reports.py             PDF 리포트 생성 (reportlab, 한글 폰트 임베드)
  fonts/
    NanumSquareR.ttf     PDF용 한글 폰트 (SIL OFL, reports.py가 TTFont로 임베드)
  routers/
    products.py       /api/products/*  (ai.ocr, experiments.locked_ingredient을 import)
    logs.py            /api/day, /api/log/*, /api/dots/*  (experiments.locked_ingredient, interactions.check_interactions 사용)
    suspects.py         /api/suspects/*
    experiments.py       /api/experiments/*
    external_factors.py   /api/external-factors/*  (airkorea.fetch_pm25 사용)
    reports.py             /api/reports/pdf

ai/
  ocr.py             OpenAI Vision으로 성분표 사진 → 성분 리스트 추출

render.yaml           Render Blueprint (build/start command, 헬스체크, env var 목록)
```

---

## 4. 작업 시 주의

- 새 기능을 추가할 때 "이미 있는 것처럼" 가정하지 말 것 — 이 파일의 §1/§2/§3이 유일하게 실제로 존재하는 스키마/API임.
- **로그인/회원가입을 다시 추가하지 말 것.** 명시적으로 걷어낸 기능임 — 해커톤 스코프상 단일 사용자로 충분하다고 판단해서 제거함. 나중에 여러 사용자가 각자 계정으로 쓰는 서비스로 확장해야 한다면, 그때 `users` 테이블 + 인증 방식(세션 쿠키든 Supabase Auth든)을 다시 설계해서 넣어야 함.
- `backend/`와 `ai/`는 둘 다 리포 루트 기준 top-level 패키지라서, `backend/routers/products.py`에서 `ai.ocr`을 import할 때 상대 임포트(`..`)가 아니라 절대 임포트(`from ai.ocr import ...`)를 씀. 실행은 항상 리포 루트에서 `uvicorn backend.main:app`으로 해야 경로가 맞음.
- 성분표 사진은 저장하지 않고 OpenAI에 전달해 텍스트만 추출한 뒤 버림(Storage 불필요).
- `analysis.py`의 `LAG_DAYS`(기본 3일)는 조정 가능한 상수. `experiments.py`의 `EXPERIMENT_DAYS`(기본 3일)는 별개 상수.
- [frontend/static/js/app.js](frontend/static/js/app.js)의 분석 결과 모달에 아직 남아있는 "2주간 이 성분 빼고 써보시겠어요?" 문구는 이제 실제 백엔드(3일 실험, `/api/experiments`)와 안 맞음 — 프론트 연동할 때 "3일"로 고치거나 실제 API를 붙여야 함.
- **스키마 바꿀 때 마이그레이션 도구가 없다는 것 주의.** `Base.metadata.create_all()`은 없는 테이블만 새로 만들고, 이미 존재하는 테이블에 컬럼을 추가하지 않음. `daily_logs.time_slot`/`trouble_dots.type` 추가할 때 로컬 sqlite는 파일 지우고 새로 만들면 되지만, Supabase처럼 실데이터 있는 DB는 `ALTER TABLE ... ADD COLUMN`을 직접 실행해줘야 함(엔진에 raw SQL로). Alembic 같은 마이그레이션 툴은 없음.
- `AIRKOREA_API_KEY`는 data.go.kr이 발급하는 **인코딩된(URL-encoded) 서비스키**를 그대로 써야 함 — [backend/airkorea.py](backend/airkorea.py)가 URL을 문자열로 직접 조립하기 때문에(httpx params로 넘기면 이중 인코딩돼서 깨짐), 키 자체가 이미 `%2F`, `%3D%3D` 같은 percent-encoding을 포함한 형태여야 정상 동작함.

---

## 5. 향후 아이디어 (미구현 — 설계만 있던 것, 우선순위 낮음)

시간이 남으면 고려할 수 있는 확장. 아래는 전부 **아직 코드에 없음**.

| 항목 | 메모 |
|---|---|
| 바코드 스캔 등록 | 올리브영은 공식 API 없음 — 공공데이터포털 화장품 데이터셋이 대안이나, 실제로 "바코드→전성분" 매핑까지 제공하는지 확인 필요 |
| 자외선 자동 연동 | 미세먼지(에어코리아)와는 다른 기관 — 기상청 API 별도 키 발급 필요. `external_factors.uv_index` 컬럼 추가하고 airkorea.py와 비슷한 모듈을 하나 더 만들면 됨 |
| pm25 자동 배치/분석 연동 | 지금은 `sync-pm25`를 수동 호출해야 채워짐. 트러블 발생일 자동 동기화나, `analyze()`에 "트러블 난 날 pm25 평균 vs 클린 기간 평균 비교" 같은 상관관계 로직은 아직 없음 |
| 다중 사용자 + 로그인 재도입 | 여러 사람이 각자 계정으로 쓰게 하려면 `users` 테이블과 인증을 다시 설계해서 넣어야 함 (§4 참고) |
| 프론트를 Vercel로 분리 | 지금은 Render 단일 서비스. 분리 시 인증이 없으니 세션 쿠키 문제는 없지만, API 호출 주소/CORS는 새로 설정 필요 |
