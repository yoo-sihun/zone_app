from datetime import date as Date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import Experiment
from ..schemas import ExperimentIn, ExperimentOut, ExperimentResult
from ..experiments import (
    get_active_experiment,
    day_count,
    is_window_complete,
    compute_result,
    EXPERIMENT_DAY_OPTIONS,
)

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


def _to_out(exp: Experiment) -> dict:
    today = Date.today()
    return {
        "id": exp.id,
        "ingredient": exp.ingredient,
        "start_date": exp.start_date,
        "status": exp.status,
        "duration_days": exp.duration_days,
        "day": day_count(exp, today),
        "is_complete": is_window_complete(exp, today),
    }


@router.get("", response_model=list[ExperimentOut])
def list_experiments(profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)):
    exps = (
        db.query(Experiment)
        .filter(Experiment.profile_id == profile_id)
        .order_by(Experiment.start_date.desc())
        .all()
    )
    return [_to_out(e) for e in exps]


@router.get("/active", response_model=ExperimentOut | None)
def get_active(profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)):
    exp = get_active_experiment(db, profile_id)
    if not exp:
        return None
    return _to_out(exp)


@router.post("", response_model=ExperimentOut)
def start_experiment(
    data: ExperimentIn, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    if get_active_experiment(db, profile_id):
        raise HTTPException(status_code=400, detail="이미 진행 중인 실험이 있습니다")
    if data.duration_days not in EXPERIMENT_DAY_OPTIONS:
        raise HTTPException(status_code=400, detail=f"실험 기간은 {EXPERIMENT_DAY_OPTIONS}일 중에서만 선택할 수 있습니다")
    exp = Experiment(
        profile_id=profile_id, ingredient=data.ingredient, start_date=Date.today(),
        status="active", duration_days=data.duration_days,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return _to_out(exp)


@router.get("/{experiment_id}/result", response_model=ExperimentResult)
def get_result(
    experiment_id: int, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    exp = (
        db.query(Experiment)
        .filter(Experiment.id == experiment_id, Experiment.profile_id == profile_id)
        .first()
    )
    if not exp:
        raise HTTPException(status_code=404, detail="실험을 찾을 수 없습니다")
    today = Date.today()
    complete = is_window_complete(exp, today)
    result = compute_result(db, exp)
    if complete and exp.status == "active":
        exp.status = "completed"
        db.commit()
    return {**_to_out(exp), **result}


@router.post("/{experiment_id}/advance-day", response_model=ExperimentOut)
def advance_day(
    experiment_id: int, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    """데모/시연용 — 실제로 하루가 지나가길 기다리지 않고 start_date를 하루 앞당겨서
    day_count를 즉시 한 칸 전진시킴. 실험 진행 상황이 서버의 실제 오늘 날짜 기준으로만
    계산되는 것과는 별개로, 이 엔드포인트는 그 기준 날짜(start_date)를 당기는 것뿐이라
    다른 로직(analyze의 LAG_DAYS 등)에는 영향 없음."""
    exp = (
        db.query(Experiment)
        .filter(Experiment.id == experiment_id, Experiment.profile_id == profile_id)
        .first()
    )
    if not exp:
        raise HTTPException(status_code=404, detail="실험을 찾을 수 없습니다")
    if exp.status != "active":
        raise HTTPException(status_code=400, detail="진행 중인 실험만 앞당길 수 있습니다")
    exp.start_date -= timedelta(days=1)
    db.commit()
    db.refresh(exp)
    return _to_out(exp)


@router.patch("/{experiment_id}")
def stop_experiment(
    experiment_id: int, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    exp = (
        db.query(Experiment)
        .filter(Experiment.id == experiment_id, Experiment.profile_id == profile_id)
        .first()
    )
    if not exp:
        raise HTTPException(status_code=404, detail="실험을 찾을 수 없습니다")
    exp.status = "stopped"
    db.commit()
    return {"ok": True}
