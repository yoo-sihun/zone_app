# ZONE — 부위별 스킨케어 원인 분석 서비스

## 프로젝트 개요
얼굴을 5개 부위(이마/오른볼/왼볼/코/턱·입주변)로 나눠 도포 제품과 트러블 발생 위치를 기록하고,
**트러블 난 부위 vs 안 난 부위를 대조군으로 삼아** 원인 성분을 역추적하는 서비스. 해커톤 제출용 프로젝트.

**실제 스택** (계획 문서가 아니라 지금 리포에 있는 그대로):
- 백엔드: FastAPI, SQLAlchemy ORM
- DB: `DATABASE_URL` 환경변수가 없으면 로컬 sqlite(`zone.db`) 자동 사용. 지정하면 아무 Postgres(Supabase 포함)든 연결 가능 — 하지만 Supabase Auth/Storage/RLS는 안 씀, 순수 커넥션 문자열로만 사용.
- 인증: **비밀번호 없는 프로필 선택 방식.** 로그인(이메일/비밀번호) 화면은 없고, 앱 첫 진입 시 프로필 목록에서 고르거나 새로 만듦(넷플릭스 프로필과 비슷). 선택한 프로필 id는 브라우저 `localStorage`에 저장되고, 이후 모든 `/api/*` 요청에 `X-Profile-Id` 헤더로 실려 감(서버는 `backend/deps.py`의 `get_current_profile_id`로 검증). 세션 쿠키/JWT/비밀번호 없음 — 헤더값만으로 "누구 데이터인지" 구분하는 가벼운 방식이라 진짜 보안은 아님(헤더 값을 바꾸면 남의 프로필 데이터에 접근 가능). 데모/개인용 스코프에서 "여러 명이 기록을 안 섞고 쓰는" 용도로만 충분.
- 프론트: `frontend/`(React/Next.js, `output: 'export'` 정적 내보내기) — Vercel에 정적 사이트로 배포. Jinja 서버 렌더링 없음, 부위 목록 같은 상수 값도 페이지 로드 시 `GET /api/config`를 fetch해서 채움. §5 참고.
- AI(OpenAI, `gpt-4o-mini`, JSON 응답 모드): 성분표 사진 → 성분 리스트(`ai/ocr.py`, Vision), 트러블 사진 → 유형 추천(`ai/trouble_classify.py`, Vision, 베타), 의심 성분 목록 재정렬(`ai/rank_suspects.py`, 텍스트 전용 — §0 참고), 부위별 관리팁(`ai/zone_tips.py`, 텍스트 전용, 배치 호출 — §0 참고). 클라이언트 생성은 `ai/client.py`에 공용화. **`openai` 패키지는 반드시 1.54+ 써야 함** — 1.51.0 등 구버전은 최신 `httpx`(0.28+)와 호환이 안 돼서 `OpenAI()` 생성 시점에 `TypeError: Client.__init__() got an unexpected keyword argument 'proxies'`로 죽음. 실제로 겪은 문제라 requirements.txt에 `openai==1.59.9`로 고정해둠 — 낮춰서 재현하지 말 것.
- 배포: **프론트/백엔드가 분리된 두 서비스.** 백엔드(FastAPI)는 Render(`render.yaml`, 실배포 URL `https://zone-app-9iiw.onrender.com`) — API 전용, HTML을 서빙하지 않음. 프론트(`frontend/`)는 Vercel에 정적 사이트로 배포. 아래 §5 참고.

실행법·환경변수는 [README.md](README.md) 참고.

**폴더 구조**: `frontend/` `backend/` `ai/` 세 폴더 — `backend/routers/products.py`가 `ai/ocr.py`를 import해서 씀. `frontend/`는 순수 정적 파일만 담고 있고 서버 코드가 전혀 없음(Vercel엔 API 로직이 없음) — API 로직/DB 접근은 전부 `backend/`의 FastAPI 하나에만 있고, 프론트는 그 API를 네트워크로 호출만 함(`X-Profile-Id` 헤더, `GET /api/config`).

**예전엔 FastAPI가 Jinja2 템플릿 + 바닐라 JS로 프론트까지 같이 서빙하는 단일 서비스였음** — 지금의 `frontend/`(React)로 완전히 교체됨. 그 구버전 코드(바닐라 JS, 서브존 확대 기능 포함)는 git 히스토리에는 남아있지만 더 이상 리포에 없고 실서비스에서도 안 씀.

---

## 0. 핵심 분석 로직 (실제 구현, [backend/analysis.py](backend/analysis.py))
- `analyze(db)` — **5단계 파이프라인**:
  1. **부위 3분할**(`_bad_zone_set_for_dot()`): 트러블 찍힌 부위를 `bad_zones`(자신 + 서브존이면 상위부위 + 상위부위면 모든 서브존)로, 그 부위의 형제 서브존(같은 상위부위의 다른 서브존)을 `neutral_zones`로, 나머지를 `good_zones`로 나눔. 형제 서브존을 Neutral로 따로 빼는 이유: 예전엔 이걸 `bad_zones`에 뭉쳐서 "대조군 오염"이 있었음(왼쪽 이마 트러블 시 오른쪽 이마까지 bad 취급) — 지금은 아예 계산에서 제외해서 bad에도 good에도 안 들어감.
  2. **기초 무해 용매 완전 배제**(`STOPWORD_INGREDIENTS`): 정제수·글리세린·부틸렌글라이콜 등은 전성분 순위와 무관하게 애초에 집계 대상에서 빠짐(부분 일치로 판정).
  3. **도포 노출 비율(exposure_ratio) 점수화**: 각 성분마다 `bad_zones에서 트러블 발생일 기준 LAG_DAYS(기본 3일) 이내 쓰인 횟수 / 전체 기간·전체 부위에서 쓰인 총 횟수`를 계산. 예전엔 `good_zones`에 한 번이라도 쓰인 성분은 통째로 제외했는데(binary safe-list), 그러면 정상 부위에 실수로 한 번 스친 성분이 억울하게 완전 삭제되는 문제(False Safe)가 있었음 — 지금은 비율로 깎일 뿐 완전히 사라지지 않음.
  4. **전성분 순서 가중치 × 성분 고유 위험 계수(α)**: `_order_weight()`가 전성분 목록에서 앞쪽(고농도)일수록 1.0에 가깝고 뒤로 갈수록 0.3까지 낮아지는 가중치를 매김. `INGREDIENT_RISK_ALPHA`가 레티놀/살리실산/AHA·BHA/향료/변성알코올 등 자극·알레르기 유발이 잘 알려진 성분에 2.0~3.0의 배수를 매김(그 외는 기본 1.0). 최종 `score = count × exposure_ratio × risk_alpha × order_weight`로 계산해 내림차순 정렬.
  5. **화학적 상성 충돌 감지**: 같은 날짜·부위·시간대에 같이 발린 성분 조합을 `interactions.py`의 `check_interactions()`(기존 도포-토글 경고와 같은 정적 테이블)로 검사해서, 그 의심 성분에 해당하는 충돌이 있으면 `collision_warnings`로 붙임.
  - 응답에 상황별 안내 문구(`message`)도 같이 반환 — 트러블 기록 없음 / 대조군(안 난 부위) 없음 / 겹치는 성분 없음 / 정상적으로 분석함, 서버에서 판단해서 문자열로 내려줌. 프론트는 이 문구를 그대로 표시하면 되고, "데이터 충분한지" 판단 로직을 프론트에서 다시 만들 필요 없음.
- **신뢰도 등급**(`confidence`) — 기록 일수(`days_tracked`, 트러블/도포 기록 중 가장 이른 날짜 기준)로 `low`(3일 미만) / `medium`(3~6일) / `high`(7일 이상) 셋 중 하나를 응답에 같이 내려줌. 각 등급별 안내 문구는 `confidence_message`. `days_tracked`/`confidence`는 프론트(`AnalysisScreen.js`)가 모달을 열기 전에도 상단 배지("기록 N일차 / 최소 3일 필요")로 미리 보여주려고 화면 진입 시 `GET /api/analysis`를 한 번 가볍게 호출해서 씀.
- **`suspects` 순위에 AI 재정렬이 한 단계 더 붙음** — `analyze()`가 위 5단계로 계산한 `score` 기준 순위를, `backend/main.py`의 `/api/analysis` 라우트가 `ai/rank_suspects.py`의 `rank_suspects()`에 한 번 더 넘겨서 최종 순서를 정함(성분 지식 기반 추가 보정 + `ai_reason` 한 줄 설명 부여). OpenAI 호출 실패 시(키 없음, 레이트리밋 등) 예외를 전부 삼키고 `score` 기준 순서 그대로 폴백함(`ai_ranked: false`) — 핵심 분석 기능이 AI 장애로 죽지 않게 함.
- **서브존/상위부위 도포 기록 매칭 버그 수정됨** — `analyze()`의 `_related_zones()` 헬퍼(범용, `products.py`의 추천 필터 등에서도 씀)로 "같은 물리적 영역"을 자신 + 상위부위(서브존이면) + 모든 서브존(상위부위면)으로 확장해서 비교함. 예전엔 `bad_zones`/`good_zones` 판정만 이렇게 확장하고, 정작 "그 부위에 뭘 발랐는지" 찾는 매칭은 `DailyLog.zone == 트러블.zone` 완전 일치만 봐서 — 트러블은 서브존에, 도포는 상위부위에(또는 반대로) 기록된 경우 서로 못 찾는 버그가 있었음. 데모 데이터 만들다가 실제로 걸려서 발견·수정함. (bad/neutral/good 3분할용으로는 형제 서브존을 bad로 안 뭉치는 별도 헬퍼 `_bad_zone_set_for_dot()`을 씀 — 위 참고.)
- **외부요인 상관관계 분석**(`_external_factor_insight()`) — `analyze()` 응답의 `external_insight` 필드. 트러블 난 날들의 평균 미세먼지/습도/자외선을 그 외 기록 있는 날(트러블 없던 날) 평균과 비교해서, 15% 이상 차이 나면 한 줄 문구로 알려줌(예: "트러블 난 날은 미세먼지가 평소보다 343% 높았어요"). 양쪽 다 최소 2일치 데이터 필요 — 부족하면 `null`(프론트는 그 항목을 그냥 안 보여줌). 상관관계일 뿐 인과관계 판단 아님.
- 바코드 스캔은 빼기로 결정함(미구현이 아니라 의도적 제외) — 실제 바코드→전성분 매핑 데이터소스가 확인 안 돼서. §6 참고.

**AM/PM 구분 + 트러블 유형**은 구현됨:
- `daily_logs.time_slot`(`am`/`pm`)로 도포 시간대 구분. `analyze()`의 `suspects`에 `time_slots` 필드가 붙어서, 어떤 성분이 아침에만/저녁에만/둘 다 발렸는지 알 수 있음 (매칭 로직 자체는 시간대로 거르지 않고, 정보만 부가).
- `trouble_dots.type`(`comedonal`/`papule`/`pustule`/`redness`)로 트러블 유형 구분. `GET /api/analysis?type=pustule`처럼 쿼리 파라미터로 특정 유형만 필터링해서 분석 가능(생략하면 전체).

**의심 성분 저장 + 3일/7일 실험 추적** ([backend/experiments.py](backend/experiments.py))은 구현됨:
- `POST /api/suspects {ingredient}`로 저장해두면, 이후 `POST /api/products`로 등록하는 제품에 그 성분이 있으면 응답의 `warnings`에 표시됨
- `POST /api/experiments {ingredient, duration_days}`로 실험 시작 — `duration_days`는 `EXPERIMENT_DAY_OPTIONS`(`[3, 7]`) 중 하나만 허용, 안 보내면 기본 3일(`EXPERIMENT_DAYS`). 각 실험은 자기 `duration_days`를 DB에 저장해 갖고 있음(실험마다 기간이 다를 수 있음) — 시작일부터 `duration_days - 1`일 뒤까지, 그 성분이 든 제품은 `GET /api/products` 응답에서 `locked: true`로 표시되고, `POST /api/log/toggle`로 새로 바르려 하면 400 에러로 막힘 (이미 기록된 건 삭제는 가능)
- `GET /api/experiments/{id}/result`에서 실험 시작 전 `duration_days`일 vs 진행 `duration_days`일의 `trouble_dots` 건수를 비교 (`before_count`/`during_count`/`improved`). 그 기간이 지난 뒤 이 엔드포인트를 호출하면 그 시점에 `status`가 `completed`로 바뀜(자동 배치 없음, 조회 시점에 확정).
- 프론트(`AnalysisModal.js`)는 분석 결과 화면에서 실험 시작 전 3일/7일 칩으로 기간을 고르게 하고, `GET /api/config`의 `experiment_day_options`로 선택지를 받아옴. `ExpBar`/`AnalysisScreen`/`ExpResultPanel`은 전부 `config.experiment_days`(전역 기본값) 대신 그 실험 객체 자신의 `duration_days`를 읽어서 표시함 — 실험마다 기간이 다를 수 있어서 전역 상수를 쓰면 틀리게 나옴.
- **프론트 연동 완료, 하단 5탭 네비게이션 구조**([frontend/lib/AppContext.js](frontend/lib/AppContext.js)) — 화면(홈/기록/분석/화장대/MY)을 JS로 전환하는 SPA 형태. 상단 헤더 로고는 "MUDI"로 리브랜딩됐음(`TopBar.js`) — 프로젝트/리포 이름 자체는 여전히 ZONE, UI 표시 이름만 바뀐 것. 피그마 리다이자인(팀 프론트 담당자 작업물)을 받아서 이 구조로 새로 짬 — 예전엔 홈/히스토리/기록/마이 4탭이었음. 지금은 아래처럼 바뀜:
  - **홈**: 오늘 기록 안 했으면 상단에 CTA 배너("오늘 아직 스킨케어 기록이 없어요" → 기록 화면으로). 오늘의 피부 날씨 카드(PM2.5·습도·자외선 전부 실제 값, 🔄 아이콘 버튼으로 셋 다 한번에 갱신). 빠른 메뉴 4개(제품 추천 → 아래 **제품 추천 화면**, 성분 분석 → 분석 모달 바로 열기, 트러블 기록 → 기록 화면을 트러블 모드로 열기, 분석 리포트). 실험 진행 중이면 카드로 한 번 더 보여줌(상단 `ExpBar`와 별개, 중복이지만 눈에 잘 띄라고 둘 다 둠). "오늘의 한눈에 요약" 카드(트러블·붉은자국 건수는 실데이터, 건조함/유분은 습도·자외선 기반 추정 — "피부 상태: 복합성" 배지는 아직 고정 텍스트라서 실제 `skin_condition`값과는 무관함, 나중에 손볼 여지 있음). 최근 사용 제품 가로 스크롤(클릭하면 그 제품을 선택한 채로 기록 화면으로 이동 + 안내 토스트, 화면 맨 위로 스크롤).
  - **제품 추천**(`RecommendScreen.js`, 하단 탭엔 없음): 홈의 "제품 추천" 버튼으로 들어가는 서브 화면(뒤로가기 화살표 헤더 — 예전 트러블 기록 화면이 쓰던 것과 같은 패턴). 부위 필터 칩(전체+5부위, `GET /api/products/recommended?zone=`) + 체크박스 다중선택으로 여러 제품을 한 번에 고른 뒤 "선택한 제품 N개 바르러 가기"를 누르면 기록 화면으로 이동, 고른 제품들이 이미 선택된 채로 시작함.
  - **기록**(`RecordScreen.js`): 상단 "🧴 화장품 도포 기록" / "🔴 트러블 발생 기록" 토글로 **한 화면 안에서 모드만 전환**함 — 예전엔 트러블 기록이 별도 화면(`screen === 'trouble'`, `openTroubleScreen()`/`closeTroubleScreen()`)이었는데 그 화면(`TroubleScreen.js`)은 삭제되고 이 토글로 합쳐짐(`AppContext.js`의 `setMode()`). 실제 주간 캘린더(`components/WeekStrip.js` — 선택한 날짜 기준 앞뒤 3일씩 7일, 탭하면 그 날짜로 이동, 미래 날짜 비활성화, `goToDate()`)는 두 모드 공통으로 위에 고정 표시.
    - **도포 모드**: 제품을 **체크박스로 다중 선택**(`toggleProductSelection`) 가능. 하나 이상 고르고 얼굴 부위를 탭해도 **바로 저장되지 않음** — `pendingApplications` 대기열에 쌓이고 그 부위엔 노란 점선 테두리가 표시됨. "기록 저장" 버튼을 눌러야 대기열을 순서대로 `POST /api/log/toggle`에 반영함(같은 배치 안에서 성분 상성 경고가 서로를 올바르게 반영하도록 순서대로 처리, 탭한 시점의 날짜/시간대를 대기 항목에 같이 저장해둬서 저장 전에 날짜·시간대를 바꿔도 안 꼬임). 이미 서버에 저장된 기록은 대기와 별개로 항상 목록으로 보임(얼굴 하이라이트는 지금 선택 중인 제품 기준이라 선택을 안 하면 그 날 뭘 발랐는지 안 보이는 문제가 있어서 목록을 따로 둠) — 항목별 "삭제"는 즉시 반영(대기 없음). 성분 상성 경고는 **더 이상 프론트에서 미리 계산하지 않음**(예전엔 백엔드 테이블을 프론트에 하드코딩해서 저장 전 미리보기를 띄웠는데, 두 테이블이 어긋날 위험이 있어서 삭제함) — "기록 저장" 시점에 서버가 실제로 계산한 경고만 토스트로 보여줌.
    - **트러블 모드**: 트러블 유형 선택 + AI 사진 판단(베타) + 얼굴 SVG(탭하면 **대기열 없이 바로** 점이 찍힘) + 그 날 기록된 트러블 목록(항목별 즉시 삭제) + 외부/생활 요인(날씨·자외선은 읽기전용, 수면시간·오늘의 피부 상태는 인라인 입력) + "생활 요인 저장" 버튼. 이 버튼은 트러블 점이 아니라 수면·피부상태 등 외부요인 폼만 저장함 — 트러블 점 자체는 탭하는 순간 이미 저장됨(버튼과 무관).
  - **분석**(`AnalysisScreen.js`): 상단에 "기록 N일차 / 최소 3일 필요" 신뢰도 배지(화면 진입 시 가볍게 `GET /api/analysis`를 한 번 호출해서 채움, §0 신뢰도 등급 참고). "✨ AI 원인 분석" 진입 카드(원인 분석 시작하기 → `AnalysisModal` 오픈) + "이미 의심되는 성분이 있나요? 실험 바로 시작하기" 카드(원인 분석 없이 바로 실험 시작 — 저장해둔 의심 성분 중 고르거나 직접 입력 + 3일/7일 선택, `StartExperimentPanel.js`) + 3단계 안내(데이터 수집/성분 분석/결과 확인) + 그 아래에 예전 히스토리 화면 전체를 그대로 포함(`HistoryScreen.js`를 하위 컴포넌트로 재사용). 실험이 진행 중이면 이 화면 전체가 진행 상황 뷰(타임라인 스텝퍼, 실험 전/중 비교, "오늘의 피부 상태 기록하러 가기" 바로가기)로 바뀜 — 실험 중단 버튼은 여기 없고 상단 `ExpBar`에만 있음(중복이라 뺌).
  - **화장대**(`VanityScreen.js`): 제품 등록/관리 전용 화면. 등록 방법 카드는 2개(이름/성분 직접입력, 전성표 촬영 OCR) + "의심 성분 자동 체크" 카드 1개 — 이건 실제로는 등록 "방법"이 아니라 `SuspectsPanel`(의심 성분 목록 관리)로 바로 연결됨. 의심 성분은 등록해두면 `POST`/`PATCH /api/products`가 어떤 등록 방법으로 넣든 자동으로 겹치는지 체크해주는 게 실제 동작이라, 카드를 "그 목록을 관리하는 곳"으로 연결한 것. **바코드 스캔 카드는 완전히 뺐음**(전엔 라벨만 있고 실제로는 아무 것도 안 하는 채로 방치돼있었는데, 그 상태로 둘 이유가 없어서 제거 — §6 참고).
  - **MY**: 현재 프로필 이름 + 프로필 전환, 외부 요인/의심 성분/리포트 바로가기, **프로필 삭제**(`DELETE /api/profiles/{id}`, 그 프로필의 모든 데이터를 연쇄 삭제하는 되돌릴 수 없는 동작 — 프론트에서 확인창 한 번만 거치므로 실수 삭제 주의)
  - 헤더의 🔔 벨 아이콘: `/api/today-status`로 오늘 기록 여부 확인해서 배지 표시 — 브라우저 꺼도 오는 진짜 푸시 아니고 앱 켰을 때만 보이는 인앱 알림
  - 외부 요인 폼(수면시간/생리주기/메모/오늘의 피부 상태/PM2.5 동기화)은 `frontend/lib/useExternalFactors.js` 훅으로 공용화 — 마이 화면 모달(`FactorsPanel.js`)과 기록 화면의 트러블 모드가 이 훅 하나를 같이 씀, 로직 중복 없음.
  - **리포트 화면**(`ReportPanel.js`, "마이"/"분석" 양쪽에서 진입) — 기간 선택하면 `GET /api/history/zone-status`로 5개 상위 부위별 상태 배지(양호/정상범위/진행중/주의) + AI 관리팁을 카드로 보여주고, 상태가 "양호"가 아닌 부위는 그 부위 기준 제품 추천(`GET /api/products/recommended?zone=`, §0)도 한 줄 붙음. PDF 다운로드 버튼은 그대로 유지(완전히 대체 아니고 같이 씀). 상태 배지 임계값은 `backend/routers/history.py`의 `_STATUS_THRESHOLDS` 상수(트러블 건수: 0=양호/≤2=정상범위/≤5=진행중/그 이상=주의) — 조정 가능.
- **디자인**: 밝은 화이트+퍼플 톤의 "의료/피부과학" 느낌(원래 틸이었다가 퍼플로 다시 칠해짐 — CSS 변수명은 여전히 `--teal`이라 실제 색상값이랑 이름이 안 맞으니 헷갈리지 말 것). 사용자가 준 레퍼런스(홈 대시보드+하단 탭 구조)를 참고해서 다시 짰지만, 레퍼런스에 있던 별점/제품 사진처럼 실제 데이터가 없는 건 그대로 안 넣었음 — 장식용 UI를 만들지 않는다는 원칙. 다만 홈 화면의 "피부 상태: 복합성" 배지는 이 원칙에서 벗어난 예외로 남아있음(위 참고, §6에도 정리).

**성분 조합 상성 경고** ([backend/interactions.py](backend/interactions.py))도 구현됨:
- DB 테이블이 아니라 코드에 하드코딩된 정적 리스트(`INGREDIENT_INTERACTIONS`) — 관리자가 수시로 바꿀 데이터가 아니라서 굳이 테이블로 뺄 필요 없다고 판단함. 조합 늘리려면 이 파일에 딕셔너리만 추가하면 됨.
- `POST /api/log/toggle`로 제품을 추가하는 순간, **같은 날짜+부위+시간대**에 이미 발린 다른 제품들과의 성분 조합을 체크해서 응답의 `warnings`에 담아 반환 (매칭되는 게 없으면 빈 배열)
- 시간대(`time_slot`)까지 일치해야 체크 대상이 됨 — 아침에 바른 성분과 저녁에 바른 성분은 실제로 섞인 적이 없으므로 상성 경고 대상에서 제외

**외부 변수(수동 입력 + 미세먼지 자동 동기화) + PDF 리포트**도 구현됨:
- `external_factors` 테이블(날짜당 1행): `POST /api/external-factors {date, sleep_hours?, menstrual_phase?, memo?, skin_condition?}`로 upsert, `GET /api/external-factors/{date}`로 조회(없으면 null). `skin_condition`은 사용자 자가진단(예: "건성"/"보통"/"유분성") — 피그마 리다이자인의 트러블 기록 화면에 들어갈 필드로 새로 추가됨, enum 검증 없는 자유 문자열.
- 미세먼지(PM2.5)는 [backend/airkorea.py](backend/airkorea.py)로 에어코리아 공공API 연동해서 자동 조회 가능: `POST /api/external-factors/{date}/sync-pm25` 호출하면 그 날짜의 PM2.5 시간별 평균을 가져와 `external_factors.pm25`에 저장(기존 sleep_hours/memo 등은 그대로 유지, pm25만 갱신). 자동 배치 없음 — 호출해야 채워짐. 기준 측정소는 `AIRKOREA_STATION` 환경변수(기본값 "종로구"=서울), 인증키는 `AIRKOREA_API_KEY`(data.go.kr에서 발급받은 **URL-인코딩된** 값 그대로 넣어야 함 — 다시 인코딩하면 깨짐).
- 습도는 [backend/weather.py](backend/weather.py)로 기상청 API Hub(`apihub.kma.go.kr`, data.go.kr이 아니라 기상청 자체 포털 — 인증 파라미터명도 `serviceKey`가 아니라 `authKey`)의 **동네예보 초단기실황조회**(`getUltraSrtNcst`) 연동해서 자동 조회 가능 — 실제 관측값(nowcast)이라 **오늘 날짜만 지원**(에어코리아 PM2.5처럼 과거 날짜 조회는 안 됨, 다른 날짜로 호출하면 400). 격자 좌표는 `KMA_NX`/`KMA_NY` 환경변수(기본값 60/127, 종로구 — `AIRKOREA_STATION` 기본값과 같은 지역), 인증키는 `KMA_API_KEY`(순수 영숫자라 에어코리아 서비스키와 달리 URL 재인코딩 걱정 없음, httpx `params`로 그냥 넘기면 됨).
- 자외선지수는 초단기실황이 아니라 **공공데이터포털(data.go.kr)**의 "기상청_생활기상지수 조회서비스"(`getUVIdxV5`) 별도 연동 — 3시간 단위 예보값이라 현재시각을 3시간 단위로 내림한 발표시간으로 조회하고 그 시점(`h0`) 값을 씀, 아직 발표 전이면 이전 발표시간으로 최대 3번 재시도. 인증키는 `KMA_UV_API_KEY`(에어코리아 서비스키처럼 URL-인코딩된 값 그대로 써야 함 — `KMA_API_KEY`의 `authKey`와는 다른 포털·다른 인코딩 방식이라 헷갈리지 말 것), 지점코드는 `KMA_AREA_NO`(기본값 `1100000000`=서울). `KMA_UV_API_KEY`만 없으면 습도는 정상 반환하고 `uv_index`만 `None`으로 채움(전체를 실패시키지 않음).
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

experiments              -- 성분 제외 실험 (3일 또는 7일)
  id, profile_id, ingredient, start_date, status(active|completed|stopped), duration_days(3|7), created_at

external_factors         -- 프로필+날짜당 1행, 수동 입력 + 미세먼지/습도/자외선 자동 동기화
  id, profile_id, date, sleep_hours, menstrual_phase, memo, pm25, humidity, uv_index, skin_condition
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

GET    /api/products             → [{id, name, ingredients, locked, last_used}]  -- locked는 진행 중인 실험 대상 성분 포함 시 true. **최근 사용한 순서로 정렬됨**(제품별 `daily_logs` 최대 날짜 기준, 한 번도 안 쓴 제품은 맨 뒤) — `last_used`는 그 날짜(없으면 null)
GET    /api/products/recommended → [{id, name, ingredients, locked}]  -- 오늘 아직 안 바른 제품 중 최대 6개(별도 추천 엔진 아님, 자기 화장대 기반). 의심 성분 든 것 + 잠긴(실험 중) 것은 zone 유무와 무관하게 항상 제외(성분 배제 원칙) — ?zone= 넘기면 그 부위 기준(그 부위엔 아직 안 바른 제품)으로 추가 필터링, 없으면 전체 부위 기준
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

GET    /api/analysis            → analyze() 결과(5단계 파이프라인, §0) + AI 재정렬. ?type=comedonal|papule|pustule|redness 로 특정 트러블 유형만 필터링 가능. suspects 각 항목에 time_slots/exposure_ratio/risk_alpha/order_weight/score/collision_warnings/ai_reason 필드 포함, 응답에 neutral_zones + 상황별 안내 message + confidence(low|medium|high)/confidence_message + days_tracked + ai_ranked(bool) + external_insight(string|null, 트러블 난 날 vs 평상시 미세먼지/습도/자외선 비교, §0) 필드 포함

GET    /api/suspects            → [{id, ingredient}]
POST   /api/suspects            {ingredient} -- 이미 있으면 그냥 기존 것 반환(idempotent)
DELETE /api/suspects/{id}

GET    /api/history/summary?start=&end= → {start, end, zone_apply_counts: {zone: count}, total_applies, dots: [{date,zone,type,x,y}]}  -- 히스토리 화면(얼굴 시각화)용 집계, 기간 내 부위별 도포 횟수 + 트러블 점 전체 목록
GET    /api/history/zone-status?start=&end= → [{zone, zone_label, status, count, suspects: [str], tip, ai_tip: bool}, ...]  -- 5개 상위 부위별 상태 배지(양호/정상범위/진행중/주의, §0 임계값) + AI 관리팁(실패 시 고정 문구로 폴백, ai_tip으로 구분). 리포트 화면(`ReportPanel.js`)에서 씀

GET    /api/experiments         → 전체 실험 목록(진행중/완료/중단 다 포함), start_date 내림차순 -- 히스토리 화면 "지난 실험"에 씀
GET    /api/experiments/active  → 진행 중인 실험 1건 또는 null
POST   /api/experiments         {ingredient, duration_days} → 실험 시작 (이미 active면 400, duration_days가 3/7 아니면 400, 안 보내면 기본 3)
GET    /api/experiments/{id}/result → {..., before_count, during_count, improved}
PATCH  /api/experiments/{id}    → 중단(status=stopped)

POST   /api/external-factors    {date, sleep_hours?, menstrual_phase?, memo?, skin_condition?} -- upsert (pm25/humidity/uv_index는 건드리지 않음, sync-* 엔드포인트로만 채워짐). skin_condition은 자유 문자열(예: "건성"/"보통"/"유분성") — 백엔드에 enum 검증 없음, menstrual_phase와 같은 패턴
GET    /api/external-factors/{date} → 값 또는 null
POST   /api/external-factors/{date}/sync-pm25 → 에어코리아에서 그 날짜 PM2.5 평균 가져와 저장
POST   /api/external-factors/{date}/sync-weather → 기상청 초단기실황조회(습도) + 생활기상지수(자외선지수) 저장. **오늘 날짜만 지원** — 다른 날짜면 400, `KMA_API_KEY` 없으면 501. `KMA_UV_API_KEY`만 없으면 습도만 채워지고 uv_index는 null

GET    /api/reports/pdf?start=&end= → PDF 파일 스트리밍 다운로드 (기간 내 트러블/도포 히스토리/의심 성분/외부 요인 요약)

GET    /api/config              → {zones, zone_labels, sub_zones, sub_to_parent, trouble_types, trouble_type_labels, experiment_days, experiment_day_options}  -- 헤더 불필요. 부위/트러블유형 등 정적 상수 값 — 프론트가 페이지 로드 시 이걸 fetch해서 채움(§5). experiment_days는 기본값(3), experiment_day_options(`[3, 7]`)는 실험 시작 시 고를 수 있는 선택지
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
  lib/useExternalFactors.js   외부 요인 폼(수면/생리주기/메모/피부상태/PM2.5) 상태+저장 로직 공용 훅 — FactorsPanel(모달)과 RecordScreen(트러블 모드 인라인)이 같이 씀
  components/              화면(screens/)·모달(modals/) 컴포넌트, FaceRecord.js/FaceHistory.js(얼굴 SVG)
    screens/RecordScreen.js    기록 화면 — 도포/트러블 두 모드를 한 화면에서 토글(§0), 트러블 전용 화면(TroubleScreen.js)은 삭제되고 여기 합쳐짐
    screens/RecommendScreen.js  제품 추천 전용 화면(§0) — 하단 탭엔 없음, 홈에서만 진입
    modals/StartExperimentPanel.js  원인 분석 없이 바로 실험 시작(§0)

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
  weather.py             기상청 API Hub 초단기실황조회(습도) + data.go.kr 생활기상지수(자외선지수) 연동, 둘 다 오늘 날짜만 지원
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
  client.py           OpenAI 클라이언트 생성 공용 함수 (ocr.py/trouble_classify.py/rank_suspects.py/zone_tips.py가 같이 씀)
  ocr.py             OpenAI Vision으로 성분표 사진 → 성분 리스트 추출
  trouble_classify.py  OpenAI Vision으로 트러블 사진 → 유형 추천 (베타, 사용자가 확인/수정 가능해야 함)
  rank_suspects.py       텍스트 전용 GPT 호출로 의심 성분 순위를 성분 지식 기반으로 재정렬 (§0) — 실패 시 원래 빈도순으로 폴백
  zone_tips.py             텍스트 전용 GPT 호출로 부위별 관리팁 생성, 5개 부위 한 번에 배치 호출 (§0) — 실패 시 상태별 고정 문구로 폴백

render.yaml           Render Blueprint (build/start command, 헬스체크, env var 목록)
```

---

## 4. 작업 시 주의

- 새 기능을 추가할 때 "이미 있는 것처럼" 가정하지 말 것 — 이 파일의 §1/§2/§3이 유일하게 실제로 존재하는 스키마/API임.
- **이메일/비밀번호 로그인을 추가하지 말 것.** 여러 프로필을 지원해야 한다는 요구는 이미 §1의 `profiles` 테이블 + `X-Profile-Id` 헤더 방식으로 해결됨 — 진짜 인증(비밀번호, 세션, JWT)이 필요해지면 그때 다시 설계할 것.
- **프론트에서 API를 직접 호출하는 새 코드를 짤 때 `X-Profile-Id` 헤더를 빠뜨리지 말 것.** `frontend/lib/api.js`의 `api()` 헬퍼는 자동으로 붙여주지만, PDF 리포트 다운로드처럼 `api()`를 안 거치고 `fetch`를 직접 쓰는 곳(`ReportPanel.js`)은 헤더를 수동으로 넣어야 함 — 브라우저 다운로드는 커스텀 헤더를 못 실어서 이렇게 됨.
- `backend/`와 `ai/`는 둘 다 리포 루트 기준 top-level 패키지라서, `backend/routers/products.py`에서 `ai.ocr`을 import할 때 상대 임포트(`..`)가 아니라 절대 임포트(`from ai.ocr import ...`)를 씀. 실행은 항상 리포 루트에서 `uvicorn backend.main:app`으로 해야 경로가 맞음.
- 성분표 사진은 저장하지 않고 OpenAI에 전달해 텍스트만 추출한 뒤 버림(Storage 불필요).
- `analysis.py`의 `LAG_DAYS`(기본 3일)는 조정 가능한 상수. `experiments.py`의 `EXPERIMENT_DAYS`(기본값, 실제 실험 기간은 `duration_days`로 실험마다 다름)/`EXPERIMENT_DAY_OPTIONS`(`[3, 7]`)는 별개 상수.
- `frontend/components/FaceRecord.js`에서 `el.isPointInFill(...)`을 쓸 때 주의: Chromium은 `SVGPoint`만 받고 `DOMPoint`를 거부함(`matrixTransform()`이 반환하는 건 DOMPoint라서 그대로 넘기면 에러). `svg.createSVGPoint()`로 다시 감싸서 넘겨야 함 — 예전 바닐라 버전에서 이 버그 때문에 트러블 위치 찍기가 Chrome에서 조용히 실패했던 적이 있어서(콘솔 에러만 뜨고 API 호출 자체가 안 됨), React 버전에도 이 우회 로직을 그대로 유지함.
- **스키마 바꿀 때 마이그레이션 도구가 없다는 것 주의.** `Base.metadata.create_all()`은 없는 테이블만 새로 만들고, 이미 존재하는 테이블에 컬럼을 추가하지 않음. `daily_logs.time_slot`/`trouble_dots.type`/`experiments.duration_days` 추가할 때 로컬 sqlite는 파일 지우고 새로 만들면 되지만, Supabase처럼 실데이터 있는 DB는 `ALTER TABLE ... ADD COLUMN`을 직접 실행해줘야 함(엔진에 raw SQL로, `duration_days`는 실제로 이렇게 추가하고 기존 프로필 전부에서 확인함). Alembic 같은 마이그레이션 툴은 없음.
- **Antigravity(다른 AI 코딩 툴)가 이 리포를 병행 편집 중일 수 있음.** 세션 중간중간 git status에 이 세션이 손 안 댄 파일이 바뀌어 나타나는 경우가 있는데, 그건 실수가 아니라 다른 도구로 작업한 것 — 되돌리지 말고 실제로 켜서 테스트한 뒤(코드만 읽고 넘어가지 말 것) 발견한 진짜 버그만 고치고, 디자인/스코프 판단(예: 특정 기능을 뺄지 채울지)은 사용자에게 확인 없이 바꾸지 말 것. 이 세션에서 이런 식으로 잡은 버그: `AnalysisScreen.js`/`RecordScreen.js`에 `useState`/`useEffect`/`api` import가 빠져서 그 화면을 열거나 특정 기능(AI 사진 판단 등)을 쓰는 순간 크래시 나던 것, `ExpResultPanel.js`가 쓰는 `loadActiveExperiment`가 `AppContext.js`의 공개 값 목록에 없어서 실험 결과 화면을 열면 크래시 나던 것 등.
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
| 바코드 스캔 등록 | **미루는 게 아니라 아예 안 하기로 결정함.** 올리브영은 공식 API 없음 — 공공데이터포털 화장품 데이터셋이 대안이나, 실제로 "바코드→전성분" 매핑까지 제공하는지 확인 안 됨. 한때 화장대 화면에 등록방법 카드로 있었지만 실제로는 아무 동작도 안 해서 카드째로 제거함(§0) |
| pm25 자동 배치 동기화 | `analyze()`의 "트러블 난 날 pm25/습도/자외선 평균 vs 클린 기간 평균 비교"는 **이미 구현됨**(`_external_factor_insight()`, §0) — 아직 없는 건 그 값을 채우는 `sync-pm25`/`sync-weather` 호출 자체를 트러블 발생 시 자동으로 트리거하는 것뿐. 지금은 사용자가 수동으로 "날씨 동기화" 버튼을 눌러야 함 |
| 진짜 인증(비밀번호/세션) | 지금은 `X-Profile-Id` 헤더만으로 프로필을 구분함 — 헤더 값을 알면 남의 데이터도 볼 수 있어서 진짜 보안은 아님. 여러 명이 진짜 비밀로 데이터를 지켜야 하면 그때 세션/비밀번호를 다시 설계 |
| 진짜 웹푸시 알림 | 지금은 앱을 열었을 때 벨 아이콘에 배지만 뜸(`/api/today-status`). 브라우저 꺼도 오는 푸시는 서비스워커+VAPID+서버 스케줄러 필요 |
| 홈 화면 "피부 상태" 배지 실데이터 연결 | 지금 "복합성" 고정 텍스트로 떠있음(§0) — 실제 `skin_condition`(트러블 기록 화면에서 입력하는 자가진단)과 연결 안 돼있음 |
