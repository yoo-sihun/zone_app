# ZONE — 부위별 스킨케어 원인 분석 서비스

## 프로젝트 개요
얼굴을 5개 부위(이마/오른볼/왼볼/코/턱·입주변)로 나눠 도포 제품과 트러블 발생 위치를 기록하고,
**트러블 난 부위 vs 안 난 부위를 대조군으로 삼아** 원인 성분을 역추적하는 서비스. 해커톤 제출용 프로젝트.

**실제 스택** (계획 문서가 아니라 지금 리포에 있는 그대로):
- 백엔드: FastAPI, SQLAlchemy ORM
- DB: `DATABASE_URL` 환경변수가 없으면 로컬 sqlite(`zone.db`) 자동 사용. 지정하면 아무 Postgres(Supabase 포함)든 연결 가능 — 하지만 Supabase Auth/Storage/RLS는 안 씀, 순수 커넥션 문자열로만 사용.
- 인증: **비밀번호 없는 프로필 선택 방식.** 로그인(이메일/비밀번호) 화면은 없고, 앱 첫 진입 시 프로필 목록에서 고르거나 새로 만듦(넷플릭스 프로필과 비슷). 선택한 프로필 id는 브라우저 `localStorage`에 저장되고, 이후 모든 `/api/*` 요청에 `X-Profile-Id` 헤더로 실려 감(서버는 `backend/deps.py`의 `get_current_profile_id`로 검증). 세션 쿠키/JWT/비밀번호 없음 — 헤더값만으로 "누구 데이터인지" 구분하는 가벼운 방식이라 진짜 보안은 아님(헤더 값을 바꾸면 남의 프로필 데이터에 접근 가능). 데모/개인용 스코프에서 "여러 명이 기록을 안 섞고 쓰는" 용도로만 충분.
- 프론트: `frontend/`(React/Next.js, `output: 'export'` 정적 내보내기) — Vercel에 정적 사이트로 배포. Jinja 서버 렌더링 없음, 부위 목록 같은 상수 값도 페이지 로드 시 `GET /api/config`를 fetch해서 채움. §5 참고.
- AI(OpenAI Vision, `gpt-4o-mini`, JSON 응답 모드): 성분표 사진 → 성분 리스트(`ai/ocr.py`), 트러블 사진 → 유형 추천(`ai/trouble_classify.py`, 베타). 클라이언트 생성은 `ai/client.py`에 공용화. **`openai` 패키지는 반드시 1.54+ 써야 함** — 1.51.0 등 구버전은 최신 `httpx`(0.28+)와 호환이 안 돼서 `OpenAI()` 생성 시점에 `TypeError: Client.__init__() got an unexpected keyword argument 'proxies'`로 죽음. 실제로 겪은 문제라 requirements.txt에 `openai==1.59.9`로 고정해둠 — 낮춰서 재현하지 말 것.
- 배포: **프론트/백엔드가 분리된 두 서비스.** 백엔드(FastAPI)는 Render(`render.yaml`, 실배포 URL `https://zone-app-9iiw.onrender.com`) — API 전용, HTML을 서빙하지 않음. 프론트(`frontend/`)는 Vercel에 정적 사이트로 배포. 아래 §5 참고.

실행법·환경변수는 [README.md](README.md) 참고.

**폴더 구조**: `frontend/` `backend/` `ai/` 세 폴더 — `backend/routers/products.py`가 `ai/ocr.py`를 import해서 씀. `frontend/`는 순수 정적 파일만 담고 있고 서버 코드가 전혀 없음(Vercel엔 API 로직이 없음) — API 로직/DB 접근은 전부 `backend/`의 FastAPI 하나에만 있고, 프론트는 그 API를 네트워크로 호출만 함(`X-Profile-Id` 헤더, `GET /api/config`).

**예전엔 FastAPI가 Jinja2 템플릿 + 바닐라 JS로 프론트까지 같이 서빙하는 단일 서비스였음** — 지금의 `frontend/`(React)로 완전히 교체됨. 그 구버전 코드(바닐라 JS, 서브존 확대 기능 포함)는 git 히스토리에는 남아있지만 더 이상 리포에 없고 실서비스에서도 안 씀.

---

## 0. 핵심 분석 로직 (실제 구현, [backend/analysis.py](backend/analysis.py))
- `analyze(db)`:
  1. `trouble_dots`에서 등장한 부위를 `bad_zones`, 나머지 4부위 중 남은 걸 `good_zones`로 나눔
  2. 각 트러블 발생일마다 해당 부위에 `LAG_DAYS`(기본 3일) 이내 발린 제품들의 성분을 집계(`hits`)
  3. `good_zones`에도 쓰인 성분(`safe`)은 의심 목록에서 제외
  4. 남은 성분을 사용 빈도순으로 정렬해 `suspects`로 반환
  5. 응답에 상황별 안내 문구(`message`)도 같이 반환 — 트러블 기록 없음 / 대조군(안 난 부위) 없음 / 겹치는 성분 없음 / 기록 기간이 `LAG_DAYS`보다 짧음 / 정상적으로 N일치 분석함, 5가지 상태를 서버에서 판단해서 문자열로 내려줌. 프론트는 이 문구를 그대로 표시하면 되고, "데이터 충분한지" 판단 로직을 프론트에서 다시 만들 필요 없음.
- 아직 없는 것: 자외선 자동 연동(기상청 API 별도 필요, 미세먼지와 다른 기관), 바코드 스캔 — §6 "향후 아이디어" 참고.

**AM/PM 구분 + 트러블 유형**은 구현됨:
- `daily_logs.time_slot`(`am`/`pm`)로 도포 시간대 구분. `analyze()`의 `suspects`에 `time_slots` 필드가 붙어서, 어떤 성분이 아침에만/저녁에만/둘 다 발렸는지 알 수 있음 (매칭 로직 자체는 시간대로 거르지 않고, 정보만 부가).
- `trouble_dots.type`(`comedonal`/`papule`/`pustule`/`redness`)로 트러블 유형 구분. `GET /api/analysis?type=pustule`처럼 쿼리 파라미터로 특정 유형만 필터링해서 분석 가능(생략하면 전체).

**의심 성분 저장 + 3일 실험 추적** ([backend/experiments.py](backend/experiments.py))은 구현됨:
- `POST /api/suspects {ingredient}`로 저장해두면, 이후 `POST /api/products`로 등록하는 제품에 그 성분이 있으면 응답의 `warnings`에 표시됨
- `POST /api/experiments {ingredient}`로 3일(`EXPERIMENT_DAYS`) 실험 시작 — 시작일부터 `EXPERIMENT_DAYS - 1`일 뒤까지, 그 성분이 든 제품은 `GET /api/products` 응답에서 `locked: true`로 표시되고, `POST /api/log/toggle`로 새로 바르려 하면 400 에러로 막힘 (이미 기록된 건 삭제는 가능)
- `GET /api/experiments/{id}/result`에서 실험 시작 전 3일 vs 진행 3일의 `trouble_dots` 건수를 비교 (`before_count`/`during_count`/`improved`). 3일이 지난 뒤 이 엔드포인트를 호출하면 그 시점에 `status`가 `completed`로 바뀜(자동 배치 없음, 조회 시점에 확정).
- **프론트 연동 완료, 홈 대시보드 + 하단 네비게이션 구조**([frontend/lib/AppContext.js](frontend/lib/AppContext.js)) — 화면 4개(홈/히스토리/기록/마이)를 JS로 전환하는 SPA 형태:
  - **홈**: 오늘의 피부 날씨 카드(PM2.5 실제 값 + 습도/자외선은 "준비 중"), 오늘 바로 추천(자기 화장대에서 오늘 아직 안 바른 제품, `/api/products/recommended`), 바로가기(기록/의심성분/실험현황/리포트)
  - **히스토리**: PDF·텍스트가 아니라 **얼굴 SVG에 직접 시각화**하는 화면 — 기간(7일/30일/전체) 선택하면 `/api/history/summary`로 부위별 도포 횟수(진할수록 자주 바른 부위, 틸 컬러 `fill-opacity`로 표현)와 그 기간의 트러블 점 전체(실제 x,y 좌표, 유형별 색상)를 같은 얼굴 위에 겹쳐서 보여줌 — "어디를 많이 발랐고 어디서 트러블이 났는지"를 한눈에 대조하려는 목적. `.hzone`(기록 화면의 `.zone`과 다른 클래스 — 기록 화면 탭 핸들러에 안 걸리게 분리)에 JS가 인라인으로 `fill-opacity` 설정. PDF 리포트 다운로드 버튼도 이 화면에 있음(완전히 대체한 게 아니라 같이 씀). "지난 실험" 목록(`GET /api/experiments`)도 여기 — 클릭하면 실험 결과 모달(활성/완료/중단 상관없이 다 조회 가능)
  - **기록**: 기존 얼굴 SVG + 제품 바른 부위/트러블 표시 — AM/PM 토글, 트러블 유형 선택, 의심 성분 저장/3일 실험 시작 버튼, 실험 진행 배너, 성분 상성 경고 토스트가 다 여기. 제품 목록에 "수정"(`PATCH /api/products/{id}`) 링크 추가됨(이전엔 삭제 후 재등록만 가능했음)
  - **마이**: 현재 프로필 이름 + 프로필 전환, 외부 요인/의심 성분/리포트 바로가기, **프로필 삭제**(`DELETE /api/profiles/{id}`, 그 프로필의 모든 데이터를 연쇄 삭제하는 되돌릴 수 없는 동작 — 프론트에서 확인창 한 번만 거치므로 실수 삭제 주의)
  - 헤더의 🔔 벨 아이콘: `/api/today-status`로 오늘 기록 여부 확인해서 배지 표시 — 브라우저 꺼도 오는 진짜 푸시 아니고 앱 켰을 때만 보이는 인앱 알림
- **디자인**: 밝은 화이트+틸 톤의 "의료/피부과학" 느낌. 사용자가 준 레퍼런스(홈 대시보드+하단 탭 구조)를 참고해서 다시 짰지만, 레퍼런스에 있던 별점/제품 사진/추천 엔진/알림 배지 중 실제 데이터가 없는 건(별점, 제품 사진) 그대로 안 넣었음 — 장식용 UI를 만들지 않는다는 원칙. 팀 프론트 담당자의 피그마 디자인이 나오면 다시 교체될 수 있음.

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
profiles                -- 비밀번호 없는 프로필 (로그인 대체)
  id, name, created_at

products
  id, profile_id, name,
  ingredients JSON  -- 문자열 리스트, 별도 ingredients 테이블 없음

daily_logs             -- "이 날 이 부위/시간대에 이 제품을 발랐다"
  id, profile_id, date, zone, time_slot(am|pm), product_id
  unique(profile_id, date, zone, product_id, time_slot)

trouble_dots            -- 트러블 위치 마킹
  id, profile_id, date, zone, type(comedonal|papule|pustule|redness), x, y

suspect_ingredients      -- 사용자가 저장해둔 의심 성분
  id, profile_id, ingredient, created_at
  unique(profile_id, ingredient)

experiments              -- 3일 성분 제외 실험
  id, profile_id, ingredient, start_date, status(active|completed|stopped), created_at

external_factors         -- 프로필+날짜당 1행, 수동 입력 + 미세먼지 자동 동기화 + 습도/자외선(스캐폴드)
  id, profile_id, date, sleep_hours, menstrual_phase, memo, pm25, humidity, uv_index
  unique(profile_id, date)
```

`products`/`daily_logs`/`trouble_dots`/`suspect_ingredients`/`experiments`/`external_factors` 전부 `profile_id` FK로 소유자를 구분함(비밀번호 없는 멀티 프로필). `ZONES = [forehead, rcheek, lcheek, nose, chin]` (모델 상단 상수).
인덱스: `daily_logs.date`, `trouble_dots.date`에 index=True, 모든 테이블의 `profile_id`에도 index.

---

## 2. 실제 API 엔드포인트

인증 대신 **모든 `/api/*` 요청에 `X-Profile-Id` 헤더 필수** (없으면 422, 존재 안 하는 id면 404). 아래 목록의 헤더 표기는 생략.

```
GET    /api/profiles             → [{id, name}]  -- 헤더 불필요, 프로필 선택 전에 호출함
POST   /api/profiles             {name} → {id, name}  -- 헤더 불필요
DELETE /api/profiles/{id}        -- 헤더 불필요. 연쇄 삭제(products/daily_logs/trouble_dots/suspect_ingredients/experiments/external_factors 전부 같이 지움), 되돌리기 불가

GET    /api/products             → [{id, name, ingredients, locked}]  -- locked는 진행 중인 실험 대상 성분 포함 시 true
GET    /api/products/recommended → [{id, name, ingredients, locked}]  -- 오늘 아직 안 바른 제품 중 최대 6개(별도 추천 엔진 아님, 자기 화장대 기반)
POST   /api/products            {name, ingredients: [str]} → {..., warnings: [str]}  -- 의심 성분 겹치면 warnings에 표시
PATCH  /api/products/{id}       {name, ingredients: [str]} → {..., warnings: [str]}  -- 이름/성분 수정, 응답 형태는 POST와 동일
DELETE /api/products/{id}
POST   /api/products/ocr        (multipart image) → {name, ingredients}

GET    /api/day/{date}          → {date, log: {zone: {am:[product_id], pm:[product_id]}}, dots: [{id,zone,type,x,y}]}
GET    /api/today-status        → {date, logged}  -- 오늘 도포 기록이 하나라도 있는지 (홈 화면 알림 배지용)
POST   /api/log/toggle          {date, zone, time_slot, product_id} → {applied, warnings}  -- 있으면 삭제(warnings 없음), 없으면 추가하고 같은 날짜/부위/시간대 성분 조합 상성 경고 반환. 실험 중인 성분이 든 제품을 새로 추가하려 하면 400
POST   /api/log/copy-previous?day=  -- 전날 기록을 오늘로 복사 (time_slot 포함) → {ok, skipped: [제품명], warnings}. 실험 중인 성분이 든 제품은 복사에서 자동 제외되고 skipped에 표시됨, 나머지에 대해 성분 상성 체크도 toggle과 동일하게 수행
DELETE /api/log/{date}

POST   /api/dots                {date, zone, type, x, y}
POST   /api/dots/classify       (multipart image) → {type: comedonal|papule|pustule|redness|null}  -- AI 추천값, null이면 판단 실패(사용자가 직접 선택해야 함)
DELETE /api/dots/{id}

GET    /api/analysis            → analyze() 결과. ?type=comedonal|papule|pustule|redness 로 특정 트러블 유형만 필터링 가능. suspects 각 항목에 time_slots 필드 포함, 응답에 상황별 안내 message 필드 포함

GET    /api/suspects            → [{id, ingredient}]
POST   /api/suspects            {ingredient} -- 이미 있으면 그냥 기존 것 반환(idempotent)
DELETE /api/suspects/{id}

GET    /api/history/summary?start=&end= → {start, end, zone_apply_counts: {zone: count}, total_applies, dots: [{date,zone,type,x,y}]}  -- 히스토리 화면(얼굴 시각화)용 집계, 기간 내 부위별 도포 횟수 + 트러블 점 전체 목록

GET    /api/experiments         → 전체 실험 목록(진행중/완료/중단 다 포함), start_date 내림차순 -- 히스토리 화면 "지난 실험"에 씀
GET    /api/experiments/active  → 진행 중인 실험 1건 또는 null
POST   /api/experiments         {ingredient} → 실험 시작 (이미 active면 400)
GET    /api/experiments/{id}/result → {..., before_count, during_count, improved}
PATCH  /api/experiments/{id}    → 중단(status=stopped)

POST   /api/external-factors    {date, sleep_hours?, menstrual_phase?, memo?} -- upsert (pm25는 건드리지 않음)
GET    /api/external-factors/{date} → 값 또는 null
POST   /api/external-factors/{date}/sync-pm25 → 에어코리아에서 그 날짜 PM2.5 평균 가져와 저장
POST   /api/external-factors/{date}/sync-weather → 기상청 습도/자외선 연동 스캐폴드, 아직 501(KMA_API_KEY 없음/미구현) 반환

GET    /api/reports/pdf?start=&end= → PDF 파일 스트리밍 다운로드 (기간 내 트러블/도포 히스토리/의심 성분/외부 요인 요약)

GET    /api/config              → {zones, zone_labels, sub_zones, sub_to_parent, trouble_types, trouble_type_labels, experiment_days}  -- 헤더 불필요. 부위/트러블유형 등 정적 상수 값 — 프론트가 페이지 로드 시 이걸 fetch해서 채움(§5)
```

백엔드(`backend/`)는 이 API 엔드포인트들만 서빙함 — 페이지 라우트(`/`)는 없음(`GET /`은 그냥 `{"service": "ZONE API", ...}` 안내용 JSON). 프론트(`frontend/`)가 별도 서비스로 SPA처럼 화면(홈/기록/히스토리/마이)을 JS로 전환함.

---

## 3. 파일 구조

```
frontend/               React/Next.js 프론트 (§5, Vercel 배포용, output:'export' 정적 내보내기). 로그인 페이지 없음
  app/page.js            화면 전환 진입점
  app/layout.js/globals.css  루트 레이아웃 + 스타일시트
  lib/api.js              API_BASE(NEXT_PUBLIC_API_BASE 환경변수, 기본값은 Render 배포 URL 하드코딩) + api() fetch 헬퍼
  lib/AppContext.js         전역 상태/액션 — 프로필/화면전환/얼굴 줌/제품/기록/분석/실험 등 대부분의 로직이 여기 모여있음
  components/              화면(screens/)·모달(modals/) 컴포넌트, FaceRecord.js/FaceHistory.js(얼굴 SVG)

backend/
  main.py            FastAPI 앱 (API 전용, HTML 서빙 없음), CORS 미들웨어, /api/config, /api/analysis
  database.py        SQLAlchemy 엔진 (DATABASE_URL 없으면 sqlite 폴백)
  deps.py             get_current_profile_id — X-Profile-Id 헤더 검증하는 FastAPI dependency, 거의 모든 라우터가 씀
  models.py          Profile / Product / DailyLog / TroubleDot / SuspectIngredient / Experiment / ExternalFactor, ZONES 상수
  schemas.py         Pydantic 요청/응답 모델
  analysis.py         트러블-성분 대조 분석 (LAG_DAYS=3)
  experiments.py       3일 실험 관련 로직 (잠금 판정, 결과 계산) — analysis.py와 별개 모듈
  interactions.py       성분 조합 상성 정적 테이블 + 체크 함수
  airkorea.py            에어코리아 미세먼지 API 호출 (PM2.5 일평균 계산)
  weather.py             기상청 습도/자외선 연동 스캐폴드 — KMA_API_KEY 없으면 RuntimeError, 아직 실제 연동 안 됨
  reports.py             PDF 리포트 생성 (reportlab, 한글 폰트 임베드)
  fonts/
    NanumSquareR.ttf     PDF용 한글 폰트 (SIL OFL, reports.py가 TTFont로 임베드)
  routers/
    profiles.py          /api/profiles/*  (헤더 검증 없음 — 프로필 고르기 전 단계라서)
    products.py       /api/products/*  (ai.ocr, experiments.locked_ingredient을 import)
    logs.py            /api/day, /api/today-status, /api/log/*, /api/dots/*  (experiments.locked_ingredient, interactions.check_interactions 사용)
    suspects.py         /api/suspects/*
    experiments.py       /api/experiments/*
    external_factors.py   /api/external-factors/*  (airkorea.fetch_pm25, weather.fetch_humidity_uv 사용)
    reports.py             /api/reports/pdf
    history.py             /api/history/summary  (히스토리 화면 얼굴 시각화용 집계)

ai/
  client.py           OpenAI 클라이언트 생성 공용 함수 (ocr.py/trouble_classify.py가 같이 씀)
  ocr.py             OpenAI Vision으로 성분표 사진 → 성분 리스트 추출
  trouble_classify.py  OpenAI Vision으로 트러블 사진 → 유형 추천 (베타, 사용자가 확인/수정 가능해야 함)

render.yaml           Render Blueprint (build/start command, 헬스체크, env var 목록)
```

---

## 4. 작업 시 주의

- 새 기능을 추가할 때 "이미 있는 것처럼" 가정하지 말 것 — 이 파일의 §1/§2/§3이 유일하게 실제로 존재하는 스키마/API임.
- **이메일/비밀번호 로그인을 추가하지 말 것.** 여러 프로필을 지원해야 한다는 요구는 이미 §1의 `profiles` 테이블 + `X-Profile-Id` 헤더 방식으로 해결됨 — 진짜 인증(비밀번호, 세션, JWT)이 필요해지면 그때 다시 설계할 것.
- **프론트에서 API를 직접 호출하는 새 코드를 짤 때 `X-Profile-Id` 헤더를 빠뜨리지 말 것.** `frontend/lib/api.js`의 `api()` 헬퍼는 자동으로 붙여주지만, PDF 리포트 다운로드처럼 `api()`를 안 거치고 `fetch`를 직접 쓰는 곳(`ReportPanel.js`)은 헤더를 수동으로 넣어야 함 — 브라우저 다운로드는 커스텀 헤더를 못 실어서 이렇게 됨.
- `backend/`와 `ai/`는 둘 다 리포 루트 기준 top-level 패키지라서, `backend/routers/products.py`에서 `ai.ocr`을 import할 때 상대 임포트(`..`)가 아니라 절대 임포트(`from ai.ocr import ...`)를 씀. 실행은 항상 리포 루트에서 `uvicorn backend.main:app`으로 해야 경로가 맞음.
- 성분표 사진은 저장하지 않고 OpenAI에 전달해 텍스트만 추출한 뒤 버림(Storage 불필요).
- `analysis.py`의 `LAG_DAYS`(기본 3일)는 조정 가능한 상수. `experiments.py`의 `EXPERIMENT_DAYS`(기본 3일)는 별개 상수.
- 분석 결과 모달의 "2주" 문구는 "3일 실험 시작" 버튼(`/api/experiments` 연동)으로 교체 완료.
- `frontend/components/FaceRecord.js`에서 `el.isPointInFill(...)`을 쓸 때 주의: Chromium은 `SVGPoint`만 받고 `DOMPoint`를 거부함(`matrixTransform()`이 반환하는 건 DOMPoint라서 그대로 넘기면 에러). `svg.createSVGPoint()`로 다시 감싸서 넘겨야 함 — 예전 바닐라 버전에서 이 버그 때문에 트러블 위치 찍기가 Chrome에서 조용히 실패했던 적이 있어서(콘솔 에러만 뜨고 API 호출 자체가 안 됨), React 버전에도 이 우회 로직을 그대로 유지함.
- **스키마 바꿀 때 마이그레이션 도구가 없다는 것 주의.** `Base.metadata.create_all()`은 없는 테이블만 새로 만들고, 이미 존재하는 테이블에 컬럼을 추가하지 않음. `daily_logs.time_slot`/`trouble_dots.type` 추가할 때 로컬 sqlite는 파일 지우고 새로 만들면 되지만, Supabase처럼 실데이터 있는 DB는 `ALTER TABLE ... ADD COLUMN`을 직접 실행해줘야 함(엔진에 raw SQL로). Alembic 같은 마이그레이션 툴은 없음.
- `AIRKOREA_API_KEY`는 data.go.kr이 발급하는 **인코딩된(URL-encoded) 서비스키**를 그대로 써야 함 — [backend/airkorea.py](backend/airkorea.py)가 URL을 문자열로 직접 조립하기 때문에(httpx params로 넘기면 이중 인코딩돼서 깨짐), 키 자체가 이미 `%2F`, `%3D%3D` 같은 percent-encoding을 포함한 형태여야 정상 동작함.

---

## 5. React 프론트(`frontend/`) + Vercel 배포

백엔드(FastAPI)는 Render에, React/Next.js 프론트(`frontend/`)는 Vercel에 — 완전히 분리된 두 서비스.

**아키텍처**:
- `output: 'export'`(next.config.mjs) — Next.js 서버가 렌더링하는 게 아니라 `next build`가 순수 정적 HTML/JS/CSS(`frontend/out/`)로 뽑아냄. Vercel엔 서버 코드가 전혀 없고, 모든 API 로직은 Render의 FastAPI 하나에만 있음.
- `frontend/lib/AppContext.js`에 프로필/화면전환/얼굴 줌/제품/기록/분석/실험 로직이 전부 모여있음 — 컴포넌트들은 대부분 `useApp()`으로 이 상태/액션을 가져다 씀.
- `frontend/lib/api.js`의 `API_BASE`는 `NEXT_PUBLIC_API_BASE` 환경변수로 **빌드 시점**에 정해짐(Next.js 정적 내보내기 관례, 런타임 hostname 감지 아님). Vercel 프로젝트 환경변수로 설정하거나, 안 하면 코드에 하드코딩된 `https://zone-app-9iiw.onrender.com`이 기본값으로 쓰임. **Render 배포 URL이 바뀌면 이 하드코딩 값도 같이 바꿔야 함.**
- `backend/main.py`에 `CORSMiddleware` 필수 — `CORS_ORIGINS` 환경변수(콤마 구분)로 허용 오리진을 좁힐 수 있고, 비워두면 `*`(전체 허용, 기본값). `X-Profile-Id`는 쿠키가 아니라 커스텀 헤더라 `allow_credentials` 없이 `*`로 열어도 안전함.
- Vercel 프로젝트 만들 때 **Root Directory를 `frontend`로 지정**해야 함(레포 루트 아님). Framework Preset은 Next.js가 자동 인식.

**알아두면 좋은 것**: 예전 바닐라 JS 프론트에는 확대(줌) 상태에서 서브존 텍스트 라벨(`.sub-label`)에 `pointer-events: auto`가 걸려있어서 라벨이 클릭을 가로채고 그 아래 실제 `.zone` path로 클릭이 전달되지 않는 실제 버그가 있었음(Playwright로 발견) — React로 새로 짜면서 `pointer-events: none`으로 고쳐서 지금은 없음.

로컬 개발: `cd frontend && npm install && npm run dev` (Next.js 개발 서버는 `localhost`만 신뢰함 — `127.0.0.1`로 접속하면 dev 서버의 cross-origin 보호(`allowedDevOrigins`)에 막혀 정적 청크가 403으로 실패하고 앱이 하이드레이션되지 않음, 실제로 이 문제를 겪음). 로컬 백엔드를 쓰려면 `frontend/.env.local`에 `NEXT_PUBLIC_API_BASE=http://localhost:<포트>` 지정(이 파일은 gitignore됨, 로컬 전용).

---

## 6. 향후 아이디어 (미구현 — 설계만 있던 것, 우선순위 낮음)

시간이 남으면 고려할 수 있는 확장. 아래는 전부 **아직 코드에 없음**.

| 항목 | 메모 |
|---|---|
| 바코드 스캔 등록 | 올리브영은 공식 API 없음 — 공공데이터포털 화장품 데이터셋이 대안이나, 실제로 "바코드→전성분" 매핑까지 제공하는지 확인 필요 |
| 기상청 습도/자외선 실연동 | `backend/weather.py`가 스캐폴드만 있음(컬럼 `external_factors.humidity`/`uv_index`, 엔드포인트 `/sync-weather`는 이미 있음). `KMA_API_KEY` 발급되면 `fetch_humidity_uv()` 내부만 채우면 됨, 호출부는 안 바꿔도 됨 |
| pm25 자동 배치/분석 연동 | 지금은 `sync-pm25`를 수동 호출해야 채워짐. 트러블 발생일 자동 동기화나, `analyze()`에 "트러블 난 날 pm25 평균 vs 클린 기간 평균 비교" 같은 상관관계 로직은 아직 없음 |
| 진짜 인증(비밀번호/세션) | 지금은 `X-Profile-Id` 헤더만으로 프로필을 구분함 — 헤더 값을 알면 남의 데이터도 볼 수 있어서 진짜 보안은 아님. 여러 명이 진짜 비밀로 데이터를 지켜야 하면 그때 세션/비밀번호를 다시 설계 |
| 진짜 웹푸시 알림 | 지금은 앱을 열었을 때 벨 아이콘에 배지만 뜸(`/api/today-status`). 브라우저 꺼도 오는 푸시는 서비스워커+VAPID+서버 스케줄러 필요 |
