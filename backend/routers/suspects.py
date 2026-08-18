from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SuspectIngredient
from ..schemas import SuspectIn, SuspectOut

router = APIRouter(prefix="/api/suspects", tags=["suspects"])


@router.get("", response_model=list[SuspectOut])
def list_suspects(db: Session = Depends(get_db)):
    return db.query(SuspectIngredient).all()


@router.post("", response_model=SuspectOut)
def add_suspect(data: SuspectIn, db: Session = Depends(get_db)):
    existing = db.query(SuspectIngredient).filter(SuspectIngredient.ingredient == data.ingredient).first()
    if existing:
        return existing
    suspect = SuspectIngredient(ingredient=data.ingredient)
    db.add(suspect)
    db.commit()
    db.refresh(suspect)
    return suspect


@router.delete("/{suspect_id}")
def remove_suspect(suspect_id: int, db: Session = Depends(get_db)):
    suspect = db.query(SuspectIngredient).filter(SuspectIngredient.id == suspect_id).first()
    if not suspect:
        raise HTTPException(status_code=404, detail="의심 성분을 찾을 수 없습니다")
    db.delete(suspect)
    db.commit()
    return {"ok": True}
