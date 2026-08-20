from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import DailyLog, TroubleDot, SuspectIngredient, Product, ExternalFactor, ZONES, ZONE_LABELS, SUB_ZONES
from ..schemas import HistorySummary
from ..interactions import check_interactions

from ai.zone_tips import generate_zone_tips

router = APIRouter(prefix="/api/history", tags=["history"])

# 최근 기간 트러블 건수 임계값 — 부위 상태 배지용 (§0 참고, 나중에 조정 가능한 상수)
_STATUS_THRESHOLDS = [(0, "양호"), (2, "정상범위"), (5, "진행중")]  # 이보다 크면 "주의"

_FALLBACK_TIPS = {
    "양호": "특별한 트러블 없이 좋은 상태예요. 지금 루틴을 유지해보세요.",
    "정상범위": "가끔 트러블이 있지만 크게 걱정할 정도는 아니에요.",
    "진행중": "트러블이 반복되고 있어요. 최근 사용한 제품을 점검해보세요.",
    "주의": "트러블이 잦은 편이에요. 원인 분석과 3일 실험을 활용해보는 걸 추천해요.",
}


def _status_bucket(count: int) -> str:
    for threshold, label in _STATUS_THRESHOLDS:
        if count <= threshold:
            return label
    return "주의"


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


@router.get("/zone-status")
def zone_status(
    start: Date, end: Date, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    """5개 상위 부위(서브존 포함)별 상태 배지 + AI 관리팁. §0 참고 — 임계값은 조정 가능한 상수."""
    if start > end:
        raise HTTPException(status_code=400, detail="시작일이 종료일보다 늦을 수 없습니다")

    dots = (
        db.query(TroubleDot)
        .filter(TroubleDot.profile_id == profile_id, TroubleDot.date >= start, TroubleDot.date <= end)
        .all()
    )
    logs = (
        db.query(DailyLog)
        .filter(DailyLog.profile_id == profile_id, DailyLog.date >= start, DailyLog.date <= end)
        .all()
    )
    products = {p.id: p for p in db.query(Product).filter(Product.profile_id == profile_id).all()}
    suspect_ings = {
        s.ingredient for s in db.query(SuspectIngredient).filter(SuspectIngredient.profile_id == profile_id).all()
    }

    summaries = []
    for parent, subs in SUB_ZONES.items():
        related = {parent, *subs}
        count = sum(1 for d in dots if d.zone in related)
        status = _status_bucket(count)

        zone_suspects = set()
        zone_ingredients = set()
        for entry in logs:
            if entry.zone not in related:
                continue
            product = products.get(entry.product_id)
            if not product:
                continue
            zone_suspects.update(ing for ing in product.ingredients if ing in suspect_ings)
            zone_ingredients.update(product.ingredients)

        collisions = check_interactions(zone_ingredients)

        summaries.append({
            "zone": parent,
            "zone_label": ZONE_LABELS[parent],
            "status": status,
            "count": count,
            "suspects": sorted(zone_suspects),
            "collisions": [{"a": c["a"], "b": c["b"], "description": c["description"]} for c in collisions],
        })

    today_factors = (
        db.query(ExternalFactor)
        .filter(ExternalFactor.profile_id == profile_id, ExternalFactor.date == Date.today())
        .first()
    )
    weather = None
    if today_factors and (today_factors.humidity is not None or today_factors.uv_index is not None):
        weather = {"humidity": today_factors.humidity, "uv_index": today_factors.uv_index}

    ai_tips = generate_zone_tips(summaries, weather)
    for s in summaries:
        s["tip"] = ai_tips.get(s["zone"]) or _FALLBACK_TIPS[s["status"]]
        s["ai_tip"] = s["zone"] in ai_tips

    return summaries
