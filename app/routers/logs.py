from datetime import date as Date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import DailyLog, TroubleDot, User, ZONES
from ..schemas import LogToggleIn, DotIn, DaySnapshot

router = APIRouter(prefix="/api", tags=["logs"])


@router.get("/day/{day}", response_model=DaySnapshot)
def get_day(day: Date, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entries = db.query(DailyLog).filter(DailyLog.user_id == user.id, DailyLog.date == day).all()
    log: dict[str, list[int]] = {z: [] for z in ZONES}
    for e in entries:
        log[e.zone].append(e.product_id)

    dots = db.query(TroubleDot).filter(TroubleDot.user_id == user.id, TroubleDot.date == day).all()
    dots_out = [{"id": d.id, "zone": d.zone, "x": d.x, "y": d.y} for d in dots]

    return {"date": day, "log": log, "dots": dots_out}


@router.post("/log/toggle")
def toggle_log(data: LogToggleIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.zone not in ZONES:
        raise HTTPException(status_code=400, detail="알 수 없는 부위입니다")
    existing = (
        db.query(DailyLog)
        .filter(
            DailyLog.user_id == user.id,
            DailyLog.date == data.date,
            DailyLog.zone == data.zone,
            DailyLog.product_id == data.product_id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"applied": False}
    entry = DailyLog(user_id=user.id, date=data.date, zone=data.zone, product_id=data.product_id)
    db.add(entry)
    db.commit()
    return {"applied": True}


@router.post("/log/copy-previous")
def copy_previous(day: Date, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prev_day = day - timedelta(days=1)
    prev_entries = db.query(DailyLog).filter(DailyLog.user_id == user.id, DailyLog.date == prev_day).all()
    db.query(DailyLog).filter(DailyLog.user_id == user.id, DailyLog.date == day).delete()
    for e in prev_entries:
        db.add(DailyLog(user_id=user.id, date=day, zone=e.zone, product_id=e.product_id))
    db.commit()
    return {"ok": True}


@router.delete("/log/{day}")
def clear_day(day: Date, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(DailyLog).filter(DailyLog.user_id == user.id, DailyLog.date == day).delete()
    db.commit()
    return {"ok": True}


@router.post("/dots")
def add_dot(data: DotIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.zone not in ZONES:
        raise HTTPException(status_code=400, detail="알 수 없는 부위입니다")
    dot = TroubleDot(user_id=user.id, date=data.date, zone=data.zone, x=data.x, y=data.y)
    db.add(dot)
    db.commit()
    db.refresh(dot)
    return {"id": dot.id, "zone": dot.zone, "x": dot.x, "y": dot.y}


@router.delete("/dots/{dot_id}")
def remove_dot(dot_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dot = db.query(TroubleDot).filter(TroubleDot.id == dot_id, TroubleDot.user_id == user.id).first()
    if not dot:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다")
    db.delete(dot)
    db.commit()
    return {"ok": True}
