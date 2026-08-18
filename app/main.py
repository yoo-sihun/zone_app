import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request, Depends
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from .database import Base, engine
from .auth import get_current_user_optional, get_current_user
from .routers import auth as auth_router
from .routers import products as products_router
from .routers import logs as logs_router
from . import models  # noqa: F401  (모델 등록을 위해 import)
from .models import ZONES, ZONE_LABELS
from .analysis import analyze
from .database import get_db
from sqlalchemy.orm import Session

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ZONE")

SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-secret-change-me")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

app.include_router(auth_router.router)
app.include_router(products_router.router)
app.include_router(logs_router.router)


@app.get("/")
def index(request: Request, user=Depends(get_current_user_optional)):
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse(
        "index.html", {"request": request, "zones": ZONES, "zone_labels": ZONE_LABELS}
    )


@app.get("/login")
def login_page(request: Request, user=Depends(get_current_user_optional)):
    if user:
        return RedirectResponse(url="/")
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/api/analysis")
def get_analysis(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return analyze(db, user.id)


@app.get("/health")
def health():
    return {"status": "ok"}
