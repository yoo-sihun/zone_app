from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AppSetting
from ..schemas import AISettingIn
from ai.client import is_ai_enabled, set_ai_enabled

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create(db: Session) -> AppSetting:
    """싱글턴 설정 행 — 없으면 지금 인메모리 상태(AI_ENABLED 환경변수 기본값)로 하나 만듦.
    헤더(X-Profile-Id) 불필요 — 프로필과 무관한 앱 전역 설정이라 /api/config, /api/profiles와 같은 성격."""
    row = db.query(AppSetting).first()
    if not row:
        row = AppSetting(ai_enabled=is_ai_enabled())
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/ai")
def get_ai_setting(db: Session = Depends(get_db)):
    row = _get_or_create(db)
    return {"ai_enabled": row.ai_enabled}


@router.patch("/ai")
def update_ai_setting(data: AISettingIn, db: Session = Depends(get_db)):
    row = _get_or_create(db)
    row.ai_enabled = data.ai_enabled
    db.commit()
    set_ai_enabled(data.ai_enabled)  # 이번 프로세스에 즉시 반영(재배포/재시작 불필요)
    return {"ai_enabled": row.ai_enabled}
