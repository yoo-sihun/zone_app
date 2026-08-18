# ZONE — 부위별 스킨케어 원인 분석 서비스

## 프로젝트 개요
얼굴을 5개 부위(이마/오른볼/왼볼/코/턱·입주변)로 나눠 도포 제품과 트러블 발생 위치를 기록하고,
**트러블 난 부위 vs 안 난 부위를 대조군으로 삼아** 원인 성분을 역추적하는 서비스. 해커톤 제출용 프로젝트.

**실제 스택** (계획 문서가 아니라 지금 리포에 있는 그대로):
- 백엔드: FastAPI, SQLAlchemy ORM
- DB: `DATABASE_URL` 환경변수가 없으면 로컬 sqlite(`zone.db`) 자동 사용. 지정하면 아무 Postgres(Supabase 포함)든 연결 가능 — 하지만 Supabase Auth/Storage/RLS는 안 씀, 순수 커넥션 문자열로만 사용.
- 인증: 자체 `users` 테이블 + `pbkdf2_sha256` 비밀번호 해시 + 서버 세션 쿠키(`SessionMiddleware`). Supabase Auth 아님.
- 프론트: FastAPI가 Jinja2 템플릿을 직접 서빙(`app/templates`) + 바닐라 JS(`app/static`). 별도 Vercel/Next.js 없음.
- OCR: OpenAI Vision(`gpt-4o-mini`, JSON 응답 모드)으로 성분표 사진 → 성분 리스트. Naver Clova/Google Vision 아님.
- 배포: Render 단일 서비스로 배포 (`render.yaml` 참고). 프론트/백엔드가 분리돼 있지 않으므로 Vercel은 쓰지 않음 — 나중에 프론트를 따로 화려하게 만들 필요가 생기면 그때 templates/static을 분리해서 Vercel로 옮기는 걸 고려(그때는 세션 쿠키 인증을 크로스 오리진용으로 손봐야 함).

실행법·환경변수는 [README.md](README.md) 참고.

---

## 0. 핵심 분석 로직 (실제 구현, [app/analysis.py](app/analysis.py))
- `analyze(db, user_id)`:
  1. 사용자의 `trouble_dots`에서 등장한 부위를 `bad_zones`, 나머지 4부위 중 남은 걸 `good_zones`로 나눔
  2. 각 트러블 발생일마다 해당 부위에 `LAG_DAYS`(기본 3일) 이내 발린 제품들의 성분을 집계(`hits`)
  3. `good_zones`에도 쓰인 성분(`safe`)은 의심 목록에서 제외
  4. 남은 성분을 사용 빈도순으로 정렬해 `suspects`로 반환
- 아직 없는 것: AM/PM 구분, 트러블 유형(화농성/붉은기 등) 구분, 3일 실험(A/B) 추적, 성분 조합 상성 체크, 외부 환경 변수(미세먼지 등) — 전부 §5 "향후 아이디어" 참고.

---

## 1. 실제 데이터 모델 ([app/models.py](app/models.py))

```
users
  id, email, hashed_password

products
  id, user_id, name,
  ingredients JSON  -- 문자열 리스트, 별도 ingredients 테이블 없음

daily_logs             -- "이 날 이 부위에 이 제품을 발랐다"
  id, user_id, date, zone, product_id
  unique(user_id, date, zone, product_id)

trouble_dots            -- 트러블 위치 마킹
  id, user_id, date, zone, x, y
```

`ZONES = [forehead, rcheek, lcheek, nose, chin]` ([app/models.py](app/models.py) 상단 상수).
인덱스: `daily_logs.date`, `trouble_dots.date`에 index=True.

---

## 2. 실제 API 엔드포인트

```
POST   /api/auth/register       {email, password}
POST   /api/auth/login          {email, password}
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/products
POST   /api/products            {name, ingredients: [str]}
DELETE /api/products/{id}
POST   /api/products/ocr        (multipart image) → {name, ingredients}

GET    /api/day/{date}          → {date, log: {zone: [product_id]}, dots}
POST   /api/log/toggle          {date, zone, product_id}  -- 있으면 삭제, 없으면 추가
POST   /api/log/copy-previous?day=  -- 전날 기록을 오늘로 복사
DELETE /api/log/{date}

POST   /api/dots                {date, zone, x, y}
DELETE /api/dots/{id}

GET    /api/analysis            → analyze() 결과
```

모든 `/api/*`는 세션 쿠키 기반 로그인 필요(`get_current_user`). `/`, `/login`은 페이지 라우트.

---

## 3. 파일 구조

```
app/
  main.py            FastAPI 앱, 페이지 라우트(/, /login), 세션 미들웨어, /api/analysis
  database.py        SQLAlchemy 엔진 (DATABASE_URL 없으면 sqlite 폴백)
  models.py          User / Product / DailyLog / TroubleDot, ZONES 상수
  schemas.py         Pydantic 요청/응답 모델
  auth.py            비밀번호 해싱(pbkdf2_sha256) + 세션 기반 로그인 의존성
  analysis.py         트러블-성분 대조 분석 (LAG_DAYS=3)
  ocr.py             OpenAI Vision으로 성분표 사진 → 성분 리스트 추출
  routers/
    auth.py          /api/auth/*
    products.py       /api/products/*
    logs.py            /api/day, /api/log/*, /api/dots/*
  templates/          login.html, index.html (Jinja2)
  static/             css/js
render.yaml           Render Blueprint (build/start command, 헬스체크, env var 목록)
```

---

## 4. 작업 시 주의

- 새 기능을 추가할 때 "이미 있는 것처럼" 가정하지 말 것 — 이 파일의 §1/§2/§3이 유일하게 실제로 존재하는 스키마/API임.
- 인증은 해커톤 스코프상 최소 구현. 회원가입/로그인이 정말 필요 없다고 판단되면 `users` 테이블·세션 미들웨어·`get_current_user`를 걷어내고 단일 사용자로 단순화하는 것도 가능 — 다만 이건 스키마/라우터 전반에 걸친 변경이라 진행 전 확인 필요.
- 성분표 사진은 저장하지 않고 OpenAI에 전달해 텍스트만 추출한 뒤 버림(Storage 불필요).
- `analysis.py`의 `LAG_DAYS`(기본 3일)는 조정 가능한 상수.

---

## 5. 향후 아이디어 (미구현 — 설계만 있던 것, 우선순위 낮음)

시간이 남으면 고려할 수 있는 확장. 아래는 전부 **아직 코드에 없음**.

| 항목 | 메모 |
|---|---|
| AM/PM 구분 도포 기록 | "레티놀은 밤에만" 같은 원인 판별에 유용. `daily_logs`에 `time_slot` 컬럼 추가 필요 |
| 트러블 유형 세분화 (화농성/붉은기 등) | `trouble_dots`에 `type` 컬럼 추가, `analyze()`를 유형별로 분리 |
| 3일/2주 실험(A/B) 추적 | 의심 성분 제외 후 트러블 건수 비교. 별도 `experiments` 테이블 필요 |
| 바코드 스캔 등록 | 올리브영은 공식 API 없음 — 공공데이터포털 화장품 데이터셋이 대안 |
| 성분 조합 상성 경고 (AHA/BHA+레티놀 등) | 정적 룩업 테이블 필요, 로직 자체는 단순 |
| 외부 환경 변수(미세먼지/자외선/수면) 연동 | 에어코리아 공공 API, 대부분은 수동 입력이 현실적 |
| PDF 리포트 내보내기 | `weasyprint`/`reportlab` 등으로 서버사이드 생성 |
| 프론트를 Vercel로 분리 | 지금은 Render 단일 서비스. 분리 시 세션 쿠키를 크로스 오리진용(SameSite=None+Secure)으로 재작업 필요 |
