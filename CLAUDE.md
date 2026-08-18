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
- 아직 없는 것: AM/PM 구분, 트러블 유형(화농성/붉은기 등) 구분, 성분 조합 상성 체크, 외부 환경 변수(미세먼지 등) — 전부 §5 "향후 아이디어" 참고.

**의심 성분 저장 + 3일 실험 추적** ([backend/experiments.py](backend/experiments.py))은 구현됨:
- `POST /api/suspects {ingredient}`로 저장해두면, 이후 `POST /api/products`로 등록하는 제품에 그 성분이 있으면 응답의 `warnings`에 표시됨
- `POST /api/experiments {ingredient}`로 3일(`EXPERIMENT_DAYS`) 실험 시작 — 시작일부터 `EXPERIMENT_DAYS - 1`일 뒤까지, 그 성분이 든 제품은 `GET /api/products` 응답에서 `locked: true`로 표시되고, `POST /api/log/toggle`로 새로 바르려 하면 400 에러로 막힘 (이미 기록된 건 삭제는 가능)
- `GET /api/experiments/{id}/result`에서 실험 시작 전 3일 vs 진행 3일의 `trouble_dots` 건수를 비교 (`before_count`/`during_count`/`improved`). 3일이 지난 뒤 이 엔드포인트를 호출하면 그 시점에 `status`가 `completed`로 바뀜(자동 배치 없음, 조회 시점에 확정).
- **프론트는 아직 이 API들을 안 씀** — 프론트 담당이 피그마 디자인 완성 후 연동 예정. 지금은 백엔드 로직/스키마만 있고 UI 연결 없음.

---

## 1. 실제 데이터 모델 ([backend/models.py](backend/models.py))

```
products
  id, name,
  ingredients JSON  -- 문자열 리스트, 별도 ingredients 테이블 없음

daily_logs             -- "이 날 이 부위에 이 제품을 발랐다"
  id, date, zone, product_id
  unique(date, zone, product_id)

trouble_dots            -- 트러블 위치 마킹
  id, date, zone, x, y

suspect_ingredients      -- 사용자가 저장해둔 의심 성분
  id, ingredient (unique), created_at

experiments              -- 3일 성분 제외 실험
  id, ingredient, start_date, status(active|completed|stopped), created_at
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

GET    /api/day/{date}          → {date, log: {zone: [product_id]}, dots}
POST   /api/log/toggle          {date, zone, product_id}  -- 있으면 삭제, 없으면 추가. 실험 중인 성분이 든 제품을 새로 추가하려 하면 400
POST   /api/log/copy-previous?day=  -- 전날 기록을 오늘로 복사
DELETE /api/log/{date}

POST   /api/dots                {date, zone, x, y}
DELETE /api/dots/{id}

GET    /api/analysis            → analyze() 결과

GET    /api/suspects            → [{id, ingredient}]
POST   /api/suspects            {ingredient} -- 이미 있으면 그냥 기존 것 반환(idempotent)
DELETE /api/suspects/{id}

GET    /api/experiments/active  → 진행 중인 실험 1건 또는 null
POST   /api/experiments         {ingredient} → 실험 시작 (이미 active면 400)
GET    /api/experiments/{id}/result → {..., before_count, during_count, improved}
PATCH  /api/experiments/{id}    → 중단(status=stopped)
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
  models.py          Product / DailyLog / TroubleDot, ZONES 상수
  schemas.py         Pydantic 요청/응답 모델
  analysis.py         트러블-성분 대조 분석 (LAG_DAYS=3)
  experiments.py       3일 실험 관련 로직 (잠금 판정, 결과 계산) — analysis.py와 별개 모듈
  routers/
    products.py       /api/products/*  (ai.ocr, experiments.locked_ingredient을 import)
    logs.py            /api/day, /api/log/*, /api/dots/*  (experiments.locked_ingredient으로 잠금 체크)
    suspects.py         /api/suspects/*
    experiments.py       /api/experiments/*

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

---

## 5. 향후 아이디어 (미구현 — 설계만 있던 것, 우선순위 낮음)

시간이 남으면 고려할 수 있는 확장. 아래는 전부 **아직 코드에 없음**.

| 항목 | 메모 |
|---|---|
| AM/PM 구분 도포 기록 | "레티놀은 밤에만" 같은 원인 판별에 유용. `daily_logs`에 `time_slot` 컬럼 추가 필요 |
| 트러블 유형 세분화 (화농성/붉은기 등) | `trouble_dots`에 `type` 컬럼 추가, `analyze()`를 유형별로 분리 |
| 바코드 스캔 등록 | 올리브영은 공식 API 없음 — 공공데이터포털 화장품 데이터셋이 대안 |
| 성분 조합 상성 경고 (AHA/BHA+레티놀 등) | 정적 룩업 테이블 필요, 로직 자체는 단순 |
| 외부 환경 변수(미세먼지/자외선/수면) 연동 | 에어코리아 공공 API, 대부분은 수동 입력이 현실적 |
| PDF 리포트 내보내기 | `weasyprint`/`reportlab` 등으로 서버사이드 생성 |
| 다중 사용자 + 로그인 재도입 | 여러 사람이 각자 계정으로 쓰게 하려면 `users` 테이블과 인증을 다시 설계해서 넣어야 함 (§4 참고) |
| 프론트를 Vercel로 분리 | 지금은 Render 단일 서비스. 분리 시 인증이 없으니 세션 쿠키 문제는 없지만, API 호출 주소/CORS는 새로 설정 필요 |
