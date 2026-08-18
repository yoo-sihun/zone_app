from datetime import date as Date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ExternalFactor
from ..schemas import ExternalFactorIn, ExternalFactorOut

router = APIRouter(prefix="/api/external-factors", tags=["external-factors"])


@router.post("", response_model=ExternalFactorOut)
def upsert_external_factor(data: ExternalFactorIn, db: Session = Depends(get_db)):
    existing = db.query(ExternalFactor).filter(ExternalFactor.date == data.date).first()
    if existing:
        existing.sleep_hours = data.sleep_hours
        existing.menstrual_phase = data.menstrual_phase
        existing.memo = data.memo
        db.commit()
        db.refresh(existing)
        return existing
    factor = ExternalFactor(**data.model_dump())
    db.add(factor)
    db.commit()
    db.refresh(factor)
    return factor


@router.get("/{day}", response_model=ExternalFactorOut | None)
def get_external_factor(day: Date, db: Session = Depends(get_db)):
    return db.query(ExternalFactor).filter(ExternalFactor.date == day).first()
