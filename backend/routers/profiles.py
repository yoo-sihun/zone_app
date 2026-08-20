from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import Profile, Product, DailyLog, TroubleDot, SuspectIngredient, Experiment, ExternalFactor
from ..schemas import ProfileIn, ProfileOut

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileOut])
def list_profiles(db: Session = Depends(get_db)):
    return db.query(Profile).order_by(Profile.id).all()


@router.post("", response_model=ProfileOut)
def create_profile(data: ProfileIn, db: Session = Depends(get_db)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="이름을 입력해주세요")
    profile = Profile(name=name)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}")
def delete_profile(
    profile_id: int,
    requester_id: int = Depends(get_current_profile_id),
    db: Session = Depends(get_db),
):
    """자기 자신(X-Profile-Id 헤더가 가리키는 프로필)만 삭제할 수 있음 — 예전엔 헤더 검증이
    아예 없어서 URL만 알면 profile_id를 순차 정수로 추측해 아무 프로필이나 지울 수 있었음."""
    if profile_id != requester_id:
        raise HTTPException(status_code=403, detail="본인 프로필만 삭제할 수 있습니다")
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다")
    # daily_logs가 products를 참조하니 먼저 지움
    for model in [DailyLog, TroubleDot, SuspectIngredient, Experiment, ExternalFactor, Product]:
        db.query(model).filter(model.profile_id == profile_id).delete()
    db.delete(profile)
    db.commit()
    return {"ok": True}
