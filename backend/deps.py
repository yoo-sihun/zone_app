from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import Profile


def get_current_profile_id(x_profile_id: int = Header(...), db: Session = Depends(get_db)) -> int:
    """No login — the frontend picks a profile and sends its id on every request
    via the X-Profile-Id header (stored in localStorage client-side)."""
    if not db.get(Profile, x_profile_id):
        raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다")
    return x_profile_id
