from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import SuspectIngredient
from ..schemas import SuspectIn, SuspectOut

router = APIRouter(prefix="/api/suspects", tags=["suspects"])


@router.get("", response_model=list[SuspectOut])
def list_suspects(profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)):
    return db.query(SuspectIngredient).filter(SuspectIngredient.profile_id == profile_id).all()


@router.post("", response_model=SuspectOut)
def add_suspect(
    data: SuspectIn, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    existing = (
        db.query(SuspectIngredient)
        .filter(SuspectIngredient.profile_id == profile_id, SuspectIngredient.ingredient == data.ingredient)
        .first()
    )
    if existing:
        return existing
    suspect = SuspectIngredient(profile_id=profile_id, ingredient=data.ingredient)
    db.add(suspect)
    db.commit()
    db.refresh(suspect)
    return suspect


@router.delete("/{suspect_id}")
def remove_suspect(
    suspect_id: int, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    suspect = (
        db.query(SuspectIngredient)
        .filter(SuspectIngredient.id == suspect_id, SuspectIngredient.profile_id == profile_id)
        .first()
    )
    if not suspect:
        raise HTTPException(status_code=404, detail="의심 성분을 찾을 수 없습니다")
    db.delete(suspect)
    db.commit()
    return {"ok": True}
