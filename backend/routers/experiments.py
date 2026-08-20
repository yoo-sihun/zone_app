from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import Experiment
from ..schemas import ExperimentIn, ExperimentOut, ExperimentResult, ExperimentStartDateIn
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


@router.patch("/{experiment_id}/start-date", response_model=ExperimentOut)
def set_start_date(
    experiment_id: int,
    data: ExperimentStartDateIn,
    profile_id: int = Depends(get_current_profile_id),
    db: Session = Depends(get_db),
):
    """데모/시연용 — 실제로 며칠이 지나가길 기다리지 않고 실험 시작일을 직접 조정해서
    day_count를 원하는 만큼 앞으로/뒤로 옮김. start_date를 당기면(과거로) 더 진행된 것처럼,
    미루면(오늘 쪽으로) 덜 진행된 것처럼 보임 — day_count/is_window_complete가 이 필드
    하나로 계산되는 걸 그대로 이용하는 것뿐이라 다른 로직(analyze의 LAG_DAYS 등)엔 영향 없음."""
    exp = (
        db.query(Experiment)
        .filter(Experiment.id == experiment_id, Experiment.profile_id == profile_id)
        .first()
    )
    if not exp:
        raise HTTPException(status_code=404, detail="실험을 찾을 수 없습니다")
    if exp.status != "active":
        raise HTTPException(status_code=400, detail="진행 중인 실험만 조정할 수 있습니다")
    if data.start_date > Date.today():
        raise HTTPException(status_code=400, detail="시작일을 미래로 설정할 수 없습니다")
    exp.start_date = data.start_date
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
