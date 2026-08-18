from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from httpx import HTTPError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ExternalFactor
from ..schemas import ExternalFactorIn, ExternalFactorOut
from ..airkorea import fetch_pm25

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


@router.post("/{day}/sync-pm25", response_model=ExternalFactorOut)
def sync_pm25(day: Date, db: Session = Depends(get_db)):
    try:
        pm25 = fetch_pm25(day)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPError as e:
        raise HTTPException(status_code=502, detail=f"에어코리아 API 호출 실패: {e}")

    if pm25 is None:
        raise HTTPException(status_code=404, detail="해당 날짜의 미세먼지 데이터를 찾을 수 없습니다")

    existing = db.query(ExternalFactor).filter(ExternalFactor.date == day).first()
    if existing:
        existing.pm25 = pm25
        db.commit()
        db.refresh(existing)
        return existing
    factor = ExternalFactor(date=day, pm25=pm25)
    db.add(factor)
    db.commit()
    db.refresh(factor)
    return factor
