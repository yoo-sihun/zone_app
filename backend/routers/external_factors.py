from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from httpx import HTTPError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import ExternalFactor
from ..schemas import ExternalFactorIn, ExternalFactorOut
from ..airkorea import fetch_pm25
from ..weather import fetch_humidity_uv

router = APIRouter(prefix="/api/external-factors", tags=["external-factors"])


def _get_or_create(db: Session, profile_id: int, day: Date) -> ExternalFactor:
    existing = (
        db.query(ExternalFactor)
        .filter(ExternalFactor.profile_id == profile_id, ExternalFactor.date == day)
        .first()
    )
    if existing:
        return existing
    factor = ExternalFactor(profile_id=profile_id, date=day)
    db.add(factor)
    return factor


@router.post("", response_model=ExternalFactorOut)
def upsert_external_factor(
    data: ExternalFactorIn, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    factor = _get_or_create(db, profile_id, data.date)
    factor.sleep_hours = data.sleep_hours
    factor.menstrual_phase = data.menstrual_phase
    factor.memo = data.memo
    factor.skin_condition = data.skin_condition
    db.commit()
    db.refresh(factor)
    return factor


@router.get("/{day}", response_model=ExternalFactorOut | None)
def get_external_factor(
    day: Date, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    return (
        db.query(ExternalFactor)
        .filter(ExternalFactor.profile_id == profile_id, ExternalFactor.date == day)
        .first()
    )


@router.post("/{day}/sync-pm25", response_model=ExternalFactorOut)
def sync_pm25(day: Date, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)):
    try:
        pm25 = fetch_pm25(day)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPError as e:
        raise HTTPException(status_code=502, detail=f"에어코리아 API 호출 실패: {e}")

    if pm25 is None:
        raise HTTPException(status_code=404, detail="해당 날짜의 미세먼지 데이터를 찾을 수 없습니다")

    factor = _get_or_create(db, profile_id, day)
    factor.pm25 = pm25
    db.commit()
    db.refresh(factor)
    return factor


@router.post("/{day}/sync-weather", response_model=ExternalFactorOut)
def sync_weather(day: Date, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)):
    try:
        result = fetch_humidity_uv(day)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except HTTPError as e:
        raise HTTPException(status_code=502, detail=f"기상청 API 호출 실패: {e}")

    factor = _get_or_create(db, profile_id, day)
    factor.humidity = result.get("humidity")
    factor.uv_index = result.get("uv_index")
    db.commit()
    db.refresh(factor)
    return factor
