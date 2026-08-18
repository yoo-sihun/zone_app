from datetime import date as Date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DailyLog, TroubleDot, Product, ZONES, TIME_SLOTS, TROUBLE_TYPES
from ..schemas import LogToggleIn, DotIn, DaySnapshot
from ..experiments import locked_ingredient

router = APIRouter(prefix="/api", tags=["logs"])


@router.get("/day/{day}", response_model=DaySnapshot)
def get_day(day: Date, db: Session = Depends(get_db)):
    entries = db.query(DailyLog).filter(DailyLog.date == day).all()
    log: dict[str, dict[str, list[int]]] = {z: {"am": [], "pm": []} for z in ZONES}
    for e in entries:
        log[e.zone][e.time_slot].append(e.product_id)

    dots = db.query(TroubleDot).filter(TroubleDot.date == day).all()
    dots_out = [{"id": d.id, "zone": d.zone, "type": d.type, "x": d.x, "y": d.y} for d in dots]

    return {"date": day, "log": log, "dots": dots_out}


@router.post("/log/toggle")
def toggle_log(data: LogToggleIn, db: Session = Depends(get_db)):
    if data.zone not in ZONES:
        raise HTTPException(status_code=400, detail="알 수 없는 부위입니다")
    if data.time_slot not in TIME_SLOTS:
        raise HTTPException(status_code=400, detail="알 수 없는 시간대입니다")
    existing = (
        db.query(DailyLog)
        .filter(
            DailyLog.date == data.date,
            DailyLog.zone == data.zone,
            DailyLog.time_slot == data.time_slot,
            DailyLog.product_id == data.product_id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"applied": False}

    locked_ing = locked_ingredient(db, data.date)
    if locked_ing:
        product = db.query(Product).filter(Product.id == data.product_id).first()
        if product and locked_ing in product.ingredients:
            raise HTTPException(
                status_code=400, detail=f"'{locked_ing}' 실험 진행 중이라 이 제품은 잠겨 있습니다"
            )

    entry = DailyLog(date=data.date, zone=data.zone, time_slot=data.time_slot, product_id=data.product_id)
    db.add(entry)
    db.commit()
    return {"applied": True}


@router.post("/log/copy-previous")
def copy_previous(day: Date, db: Session = Depends(get_db)):
    prev_day = day - timedelta(days=1)
    prev_entries = db.query(DailyLog).filter(DailyLog.date == prev_day).all()
    db.query(DailyLog).filter(DailyLog.date == day).delete()
    for e in prev_entries:
        db.add(DailyLog(date=day, zone=e.zone, time_slot=e.time_slot, product_id=e.product_id))
    db.commit()
    return {"ok": True}


@router.delete("/log/{day}")
def clear_day(day: Date, db: Session = Depends(get_db)):
    db.query(DailyLog).filter(DailyLog.date == day).delete()
    db.commit()
    return {"ok": True}


@router.post("/dots")
def add_dot(data: DotIn, db: Session = Depends(get_db)):
    if data.zone not in ZONES:
        raise HTTPException(status_code=400, detail="알 수 없는 부위입니다")
    if data.type not in TROUBLE_TYPES:
        raise HTTPException(status_code=400, detail="알 수 없는 트러블 유형입니다")
    dot = TroubleDot(date=data.date, zone=data.zone, type=data.type, x=data.x, y=data.y)
    db.add(dot)
    db.commit()
    db.refresh(dot)
    return {"id": dot.id, "zone": dot.zone, "type": dot.type, "x": dot.x, "y": dot.y}


@router.delete("/dots/{dot_id}")
def remove_dot(dot_id: int, db: Session = Depends(get_db)):
    dot = db.query(TroubleDot).filter(TroubleDot.id == dot_id).first()
    if not dot:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다")
    db.delete(dot)
    db.commit()
    return {"ok": True}
