from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Experiment
from ..schemas import ExperimentIn, ExperimentOut, ExperimentResult
from ..experiments import (
    get_active_experiment,
    day_count,
    is_window_complete,
    compute_result,
)

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


def _to_out(exp: Experiment) -> dict:
    today = Date.today()
    return {
        "id": exp.id,
        "ingredient": exp.ingredient,
        "start_date": exp.start_date,
        "status": exp.status,
        "day": day_count(exp, today),
        "is_complete": is_window_complete(exp, today),
    }


@router.get("/active", response_model=ExperimentOut | None)
def get_active(db: Session = Depends(get_db)):
    exp = get_active_experiment(db)
    if not exp:
        return None
    return _to_out(exp)


@router.post("", response_model=ExperimentOut)
def start_experiment(data: ExperimentIn, db: Session = Depends(get_db)):
    if get_active_experiment(db):
        raise HTTPException(status_code=400, detail="이미 진행 중인 실험이 있습니다")
    exp = Experiment(ingredient=data.ingredient, start_date=Date.today(), status="active")
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return _to_out(exp)


@router.get("/{experiment_id}/result", response_model=ExperimentResult)
def get_result(experiment_id: int, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="실험을 찾을 수 없습니다")
    today = Date.today()
    complete = is_window_complete(exp, today)
    result = compute_result(db, exp)
    if complete and exp.status == "active":
        exp.status = "completed"
        db.commit()
    return {
        "id": exp.id,
        "ingredient": exp.ingredient,
        "start_date": exp.start_date,
        "status": exp.status,
        "day": day_count(exp, today),
        "is_complete": complete,
        **result,
    }


@router.patch("/{experiment_id}")
def stop_experiment(experiment_id: int, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="실험을 찾을 수 없습니다")
    exp.status = "stopped"
    db.commit()
    return {"ok": True}
