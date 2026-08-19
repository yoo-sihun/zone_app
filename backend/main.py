from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .deps import get_current_profile_id
from .routers import products as products_router
from .routers import logs as logs_router
from .routers import suspects as suspects_router
from .routers import experiments as experiments_router
from .routers import external_factors as external_factors_router
from .routers import reports as reports_router
from .routers import profiles as profiles_router
from . import models  # noqa: F401  (모델 등록을 위해 import)
from .models import ZONES, ZONE_LABELS, TROUBLE_TYPES, TROUBLE_TYPE_LABELS
from .analysis import analyze
from .experiments import EXPERIMENT_DAYS

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ZONE")

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

app.include_router(profiles_router.router)
app.include_router(products_router.router)
app.include_router(logs_router.router)
app.include_router(suspects_router.router)
app.include_router(experiments_router.router)
app.include_router(external_factors_router.router)
app.include_router(reports_router.router)


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "zones": ZONES,
            "zone_labels": ZONE_LABELS,
            "trouble_types": TROUBLE_TYPES,
            "trouble_type_labels": TROUBLE_TYPE_LABELS,
            "experiment_days": EXPERIMENT_DAYS,
        },
    )


@app.get("/api/analysis")
def get_analysis(
    type: str | None = None,
    profile_id: int = Depends(get_current_profile_id),
    db: Session = Depends(get_db),
):
    if type is not None and type not in TROUBLE_TYPES:
        raise HTTPException(status_code=400, detail="알 수 없는 트러블 유형입니다")
    return analyze(db, profile_id, dot_type=type)


@app.get("/health")
def health():
    return {"status": "ok"}
