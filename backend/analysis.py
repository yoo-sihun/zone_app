from collections import defaultdict
from datetime import date as Date, timedelta

from sqlalchemy.orm import Session

from .models import DailyLog, TroubleDot, Product, ZONES

LAG_DAYS = 3  # 트러블 발생일 기준 며칠 전까지의 사용 기록을 의심하는지


def analyze(db: Session, dot_type: str | None = None) -> dict:
    dots_query = db.query(TroubleDot)
    if dot_type:
        dots_query = dots_query.filter(TroubleDot.type == dot_type)
    dots = dots_query.all()
    if not dots:
        return {
            "bad_zones": [],
            "good_zones": ZONES,
            "events": 0,
            "suspects": [],
            "message": "아직 트러블 기록이 없어요. '트러블 표시'에서 발생 위치를 먼저 남겨주세요 — 비교할 부위가 있어야 원인을 좁힐 수 있어요.",
        }

    bad_zones = sorted({d.zone for d in dots})
    good_zones = [z for z in ZONES if z not in bad_zones]

    products = {p.id: p for p in db.query(Product).all()}

    # ingredient -> {count, zones:set, time_slots:set, product_ids:set}
    hits: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "zones": set(), "time_slots": set(), "product_ids": set()}
    )

    for dot in dots:
        window_start = dot.date - timedelta(days=LAG_DAYS)
        entries = (
            db.query(DailyLog)
            .filter(
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
                h["time_slots"].add(entry.time_slot)
                h["product_ids"].add(product.id)

    # 안 난 부위(대조군)에서 쓰인 성분은 용의선상에서 제외
    safe: set[str] = set()
    if good_zones:
        good_entries = db.query(DailyLog).filter(DailyLog.zone.in_(good_zones)).all()
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
            "time_slots": sorted(v["time_slots"]),
            "product_ids": sorted(v["product_ids"]),
        }
        for ing, v in hits.items()
        if ing not in safe
    ]
    suspects.sort(key=lambda s: s["count"], reverse=True)

    # 기록 기간 파악 (트러블/도포 기록 중 가장 이른 날짜 기준)
    log_dates = [r[0] for r in db.query(DailyLog.date).all()]
    all_dates = [d.date for d in dots] + log_dates
    days_tracked = (Date.today() - min(all_dates)).days + 1 if all_dates else 0

    if not good_zones:
        message = "모든 부위에 트러블이 나서 비교할 '깨끗한 부위'가 없어요. 이 상태에서는 원인 성분을 좁히기 어려워요 — 안 난 부위가 생기면 훨씬 정확해집니다."
    elif not suspects:
        message = "트러블 난 부위에만 발린 성분을 찾지 못했어요. 성분 외 원인(수면 부족, 마찰, 호르몬 변화 등)일 수 있어요."
    elif days_tracked < LAG_DAYS:
        message = f"아직 기록 기간이 {days_tracked}일로 짧아요. 최소 {LAG_DAYS}일 이상 꾸준히 기록하면 더 정확해져요."
    else:
        message = f"{days_tracked}일간의 기록을 바탕으로 분석했어요."

    return {
        "bad_zones": bad_zones,
        "good_zones": good_zones,
        "events": len(dots),
        "suspects": suspects,
        "message": message,
    }
