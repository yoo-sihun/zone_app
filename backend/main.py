from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from fastapi import Depends

from .database import Base, engine, get_db
from .routers import products as products_router
from .routers import logs as logs_router
from . import models  # noqa: F401  (모델 등록을 위해 import)
from .models import ZONES, ZONE_LABELS
from .analysis import analyze

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ZONE")

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

app.include_router(products_router.router)
app.include_router(logs_router.router)


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(
        "index.html", {"request": request, "zones": ZONES, "zone_labels": ZONE_LABELS}
    )


@app.get("/api/analysis")
def get_analysis(db: Session = Depends(get_db)):
    return analyze(db)


@app.get("/health")
def health():
    return {"status": "ok"}
