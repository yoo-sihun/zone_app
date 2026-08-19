from collections import defaultdict
from datetime import date as Date, timedelta

from sqlalchemy.orm import Session

from .models import DailyLog, TroubleDot, Product, ExternalFactor, ZONES, SUB_TO_PARENT, SUB_ZONES

LAG_DAYS = 3  # 트러블 발생일 기준 며칠 전까지의 사용 기록을 의심하는지

# (필드명, 표시 이름, 단위) — 트러블 난 날 vs 평상시 평균 비교 대상
_EXTERNAL_FACTOR_FIELDS = [
    ("pm25", "미세먼지", "㎍/㎥"),
    ("humidity", "습도", "%"),
    ("uv_index", "자외선지수", ""),
]


def _external_factor_insight(db: Session, profile_id: int, dots: list[TroubleDot]) -> str | None:
    """트러블 난 날의 미세먼지/습도/자외선 평균을 그 외 날(기록은 있지만 트러블 없던 날)과 비교.
    양쪽 다 최소 2일치 데이터가 있어야 비교하고, 차이가 15% 미만이면 의미 없다고 보고 건너뜀.
    데이터가 부족하면 None(프론트는 이 항목을 아예 안 보여줌)."""
    trouble_dates = {d.date for d in dots}
    if not trouble_dates:
        return None
    factors = db.query(ExternalFactor).filter(ExternalFactor.profile_id == profile_id).all()
    if not factors:
        return None

    lines = []
    for field, label, unit in _EXTERNAL_FACTOR_FIELDS:
        trouble_vals = [getattr(f, field) for f in factors if f.date in trouble_dates and getattr(f, field) is not None]
        clean_vals = [getattr(f, field) for f in factors if f.date not in trouble_dates and getattr(f, field) is not None]
        if len(trouble_vals) < 2 or len(clean_vals) < 2:
            continue
        trouble_avg = sum(trouble_vals) / len(trouble_vals)
        clean_avg = sum(clean_vals) / len(clean_vals)
        if clean_avg == 0:
            continue
        diff_ratio = (trouble_avg - clean_avg) / clean_avg
        if abs(diff_ratio) < 0.15:
            continue
        direction = "높았어요" if diff_ratio > 0 else "낮았어요"
        lines.append(
            f"트러블 난 날은 {label}가 평소보다 {abs(diff_ratio) * 100:.0f}% {direction}"
            f" (트러블일 평균 {trouble_avg:.1f}{unit} vs 평상시 {clean_avg:.1f}{unit})"
        )

    return " ".join(lines) if lines else None


def _related_zones(zone: str) -> set[str]:
    """서브존과 상위부위를 서로 연결된 것으로 취급 — 자신 + (서브존이면) 상위부위 + (상위부위면) 모든 서브존.
    bad_zones 판정과 실제 도포 기록 매칭 둘 다 이 확장을 써야 일관됨(전에는 bad_zones만 확장하고
    도포 기록 매칭은 정확히 같은 zone 문자열만 봐서, 트러블은 서브존에 · 도포는 상위부위에 기록된
    경우 서로 못 찾는 버그가 있었음)."""
    related = {zone}
    if zone in SUB_TO_PARENT:
        related.add(SUB_TO_PARENT[zone])
    if zone in SUB_ZONES:
        related.update(SUB_ZONES[zone])
    return related


def analyze(db: Session, profile_id: int, dot_type: str | None = None) -> dict:
    dots_query = db.query(TroubleDot).filter(TroubleDot.profile_id == profile_id)
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
            "external_insight": None,
        }

    bad_zones_expanded = set()
    for dot in dots:
        bad_zones_expanded.update(_related_zones(dot.zone))

    bad_zones = sorted(list(bad_zones_expanded))
    good_zones = [z for z in ZONES if z not in bad_zones]

    products = {p.id: p for p in db.query(Product).filter(Product.profile_id == profile_id).all()}

    # ingredient -> {count, zones:set, time_slots:set, product_ids:set}
    hits: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "zones": set(), "time_slots": set(), "product_ids": set()}
    )

    for dot in dots:
        window_start = dot.date - timedelta(days=LAG_DAYS)
        entries = (
            db.query(DailyLog)
            .filter(
                DailyLog.profile_id == profile_id,
                DailyLog.zone.in_(_related_zones(dot.zone)),
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
        good_entries = (
            db.query(DailyLog)
            .filter(DailyLog.profile_id == profile_id, DailyLog.zone.in_(good_zones))
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
            "time_slots": sorted(v["time_slots"]),
            "product_ids": sorted(v["product_ids"]),
        }
        for ing, v in hits.items()
        if ing not in safe
    ]
    suspects.sort(key=lambda s: s["count"], reverse=True)

    # 기록 기간 파악 (트러블/도포 기록 중 가장 이른 날짜 기준)
    log_dates = [r[0] for r in db.query(DailyLog.date).filter(DailyLog.profile_id == profile_id).all()]
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
        "external_insight": _external_factor_insight(db, profile_id, dots),
    }
