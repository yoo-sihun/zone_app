from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
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
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다")
    # daily_logs가 products를 참조하니 먼저 지움
    for model in [DailyLog, TroubleDot, SuspectIngredient, Experiment, ExternalFactor, Product]:
        db.query(model).filter(model.profile_id == profile_id).delete()
    db.delete(profile)
    db.commit()
    return {"ok": True}
