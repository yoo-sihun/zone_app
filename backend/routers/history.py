from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import DailyLog, TroubleDot, ZONES
from ..schemas import HistorySummary

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/summary", response_model=HistorySummary)
def history_summary(
    start: Date, end: Date, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    if start > end:
        raise HTTPException(status_code=400, detail="시작일이 종료일보다 늦을 수 없습니다")

    logs = (
        db.query(DailyLog)
        .filter(DailyLog.profile_id == profile_id, DailyLog.date >= start, DailyLog.date <= end)
        .all()
    )
    zone_apply_counts = {z: 0 for z in ZONES}
    for entry in logs:
        zone_apply_counts[entry.zone] += 1

    dots = (
        db.query(TroubleDot)
        .filter(TroubleDot.profile_id == profile_id, TroubleDot.date >= start, TroubleDot.date <= end)
        .order_by(TroubleDot.date)
        .all()
    )

    return {
        "start": start,
        "end": end,
        "zone_apply_counts": zone_apply_counts,
        "total_applies": len(logs),
        "dots": [{"date": d.date, "zone": d.zone, "type": d.type, "x": d.x, "y": d.y} for d in dots],
    }
