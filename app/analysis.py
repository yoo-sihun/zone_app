from collections import defaultdict
from datetime import timedelta

from sqlalchemy.orm import Session

from .models import DailyLog, TroubleDot, Product, ZONES

LAG_DAYS = 3  # 트러블 발생일 기준 며칠 전까지의 사용 기록을 의심하는지


def analyze(db: Session, user_id: int) -> dict:
    dots = db.query(TroubleDot).filter(TroubleDot.user_id == user_id).all()
    if not dots:
        return {"bad_zones": [], "good_zones": ZONES, "events": 0, "suspects": []}

    bad_zones = sorted({d.zone for d in dots})
    good_zones = [z for z in ZONES if z not in bad_zones]

    products = {p.id: p for p in db.query(Product).filter(Product.user_id == user_id).all()}

    # ingredient -> {count, zones:set, product_ids:set}
    hits: dict[str, dict] = defaultdict(lambda: {"count": 0, "zones": set(), "product_ids": set()})

    for dot in dots:
        window_start = dot.date - timedelta(days=LAG_DAYS)
        entries = (
            db.query(DailyLog)
            .filter(
                DailyLog.user_id == user_id,
                DailyLog.zone == dot.zone,
                DailyLog.date >= window_start,
                DailyLog.date <= dot.date,
            )
            .all()
        )
        for entry in entries:
            product = products.get(entry.product_id)
            if not product:
                continue
            for ing in product.ingredients:
                h = hits[ing]
                h["count"] += 1
                h["zones"].add(dot.zone)
                h["product_ids"].add(product.id)

    # 안 난 부위(대조군)에서 쓰인 성분은 용의선상에서 제외
    safe: set[str] = set()
    if good_zones:
        good_entries = (
            db.query(DailyLog)
            .filter(DailyLog.user_id == user_id, DailyLog.zone.in_(good_zones))
            .all()
        )
        for entry in good_entries:
            product = products.get(entry.product_id)
            if not product:
                continue
            safe.update(product.ingredients)

    suspects = [
        {
            "ingredient": ing,
            "count": v["count"],
            "zones": sorted(v["zones"]),
            "product_ids": sorted(v["product_ids"]),
        }
        for ing, v in hits.items()
        if ing not in safe
    ]
    suspects.sort(key=lambda s: s["count"], reverse=True)

    return {
        "bad_zones": bad_zones,
        "good_zones": good_zones,
        "events": len(dots),
        "suspects": suspects,
    }
