from datetime import date as Date, timedelta

from sqlalchemy.orm import Session

from .models import Experiment, TroubleDot

EXPERIMENT_DAYS = 3  # 실험 시작 시 duration_days를 안 보내면 쓰는 기본값
EXPERIMENT_DAY_OPTIONS = [3, 7]  # 사용자가 실험 시작할 때 고를 수 있는 기간


def get_active_experiment(db: Session, profile_id: int) -> Experiment | None:
    return (
        db.query(Experiment)
        .filter(Experiment.profile_id == profile_id, Experiment.status == "active")
        .first()
    )


def day_count(experiment: Experiment, today: Date) -> int:
    return min(experiment.duration_days, max(1, (today - experiment.start_date).days + 1))


def is_window_complete(experiment: Experiment, today: Date) -> bool:
    return (today - experiment.start_date).days >= experiment.duration_days


def locked_ingredient(db: Session, profile_id: int, check_date: Date) -> str | None:
    """Ingredient locked for daily_logs on `check_date`, or None if nothing's locked."""
    exp = get_active_experiment(db, profile_id)
    if not exp:
        return None
    window_end = exp.start_date + timedelta(days=exp.duration_days - 1)
    if exp.start_date <= check_date <= window_end:
        return exp.ingredient
    return None


def compute_result(db: Session, experiment: Experiment) -> dict:
    start = experiment.start_date
    before_start = start - timedelta(days=experiment.duration_days)
    before_end = start - timedelta(days=1)
    during_end = start + timedelta(days=experiment.duration_days - 1)

    before_count = (
        db.query(TroubleDot)
        .filter(
            TroubleDot.profile_id == experiment.profile_id,
            TroubleDot.date >= before_start,
            TroubleDot.date <= before_end,
        )
        .count()
    )
    during_count = (
        db.query(TroubleDot)
        .filter(
            TroubleDot.profile_id == experiment.profile_id,
            TroubleDot.date >= start,
            TroubleDot.date <= during_end,
        )
        .count()
    )
    return {"before_count": before_count, "during_count": during_count, "improved": during_count < before_count}
