import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import Base, engine, get_db, SessionLocal
from .deps import get_current_profile_id
from .routers import products as products_router
from .routers import logs as logs_router
from .routers import suspects as suspects_router
from .routers import experiments as experiments_router
from .routers import external_factors as external_factors_router
from .routers import reports as reports_router
from .routers import profiles as profiles_router
from .routers import history as history_router
from .routers import catalog as catalog_router
from .routers import settings as settings_router
from . import models  # noqa: F401  (모델 등록을 위해 import)
from .models import ZONES, ZONE_LABELS, TROUBLE_TYPES, TROUBLE_TYPE_LABELS, SUB_ZONES, SUB_TO_PARENT, MEDICAL_DISCLAIMER, AppSetting
from .analysis import analyze
from .experiments import EXPERIMENT_DAYS, EXPERIMENT_DAY_OPTIONS
from ai.rank_suspects import rank_suspects
from ai.toggle import set_enabled

Base.metadata.create_all(bind=engine)

# 서버 시작 시 DB에 저장된 AI on/off 값을 인메모리 플래그에 반영(ai/toggle.py) —
# 안 하면 재시작/콜드스타트 때마다 기본값(켜짐)으로 되돌아가서 껐던 게 무시됨
with SessionLocal() as _startup_db:
    _setting = _startup_db.query(AppSetting).first()
    if _setting:
        set_enabled(_setting.ai_enabled)

app = FastAPI(title="ZONE")

# 프론트(frontend/, Vercel에 별도 배포)가 다른 오리진에서 이 API를 호출하므로 CORS 필요
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles_router.router)
app.include_router(products_router.router)
app.include_router(logs_router.router)
app.include_router(suspects_router.router)
app.include_router(experiments_router.router)
app.include_router(external_factors_router.router)
app.include_router(reports_router.router)
app.include_router(history_router.router)
app.include_router(catalog_router.router)
app.include_router(settings_router.router)


@app.get("/")
def index():
    return {"service": "ZONE API", "docs": "/docs", "health": "/health"}


@app.get("/api/config")
def get_config():
    """부위/트러블유형 등 정적 상수 값. 프론트가 페이지 로드 시 fetch해서 채움
    (프론트를 Vercel 등 별도 오리진에 정적 배포해도 동작하도록 Jinja 서버 렌더링 대신 API로 내려줌)."""
    return {
        "zones": ZONES,
        "zone_labels": ZONE_LABELS,
        "sub_zones": SUB_ZONES,
        "sub_to_parent": SUB_TO_PARENT,
        "trouble_types": TROUBLE_TYPES,
        "trouble_type_labels": TROUBLE_TYPE_LABELS,
        "experiment_days": EXPERIMENT_DAYS,
        "experiment_day_options": EXPERIMENT_DAY_OPTIONS,
        "disclaimer": MEDICAL_DISCLAIMER,
    }


@app.get("/api/analysis")
def get_analysis(
    type: str | None = None,
    profile_id: int = Depends(get_current_profile_id),
    db: Session = Depends(get_db),
):
    if type is not None and type not in TROUBLE_TYPES:
        raise HTTPException(status_code=400, detail="알 수 없는 트러블 유형입니다")
    result = analyze(db, profile_id, dot_type=type)
    result["suspects"], result["ai_ranked"] = rank_suspects(result["suspects"])
    return result


@app.get("/health")
def health():
    return {"status": "ok"}
