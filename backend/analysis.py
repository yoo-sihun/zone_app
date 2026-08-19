from collections import defaultdict
from datetime import date as Date, timedelta

from sqlalchemy.orm import Session

from .models import DailyLog, TroubleDot, Product, ExternalFactor, ZONES, SUB_TO_PARENT, SUB_ZONES
from .interactions import check_interactions

LAG_DAYS = 3  # 트러블 발생일 기준 며칠 전까지의 사용 기록을 의심하는지

# 신뢰도 등급 기준 — 기록 일수(days_tracked)로 판단
CONFIDENCE_LOW_THRESHOLD = 3   # 이 미만이면 LOW
CONFIDENCE_HIGH_THRESHOLD = 7  # 이 이상이면 HIGH, 그 사이는 MEDIUM

_CONFIDENCE_MESSAGES = {
    "low": "데이터가 부족하여 신뢰도가 낮습니다. 정확한 대조 분석을 위해 최소 3일 이상의 도포 기록을 채워주세요. 지금 결과는 1차 단순 추정치예요.",
    "medium": f"대조군 비교 분석이 가능한 수준이에요 (기본 신뢰도). {CONFIDENCE_HIGH_THRESHOLD}일 이상 채우면 신뢰도가 더 올라가요.",
    "high": "피부 재생·염증 누적 주기를 반영한 최고 신뢰도 결과예요.",
}

# 2단계: 거의 모든 제품에 들어가는 기초 무해 용매(베이스) — 전성분 순위와 무관하게 의심 목록에서 완전 배제.
# 하드코딩 정적 목록(interactions.py의 INGREDIENT_INTERACTIONS와 같은 이유로 테이블로 안 뺌) — 부분 일치로 검사.
STOPWORD_INGREDIENTS = [
    "정제수", "물", "글리세린", "부틸렌글라이콜", "프로필렌글라이콜", "다이프로필렌글라이콜",
    "판테놀", "카보머", "다이메티콘",
]

# 4단계: 자극·알레르기 유발이 잘 알려진 활성 성분에 붙는 고유 위험 계수(α). 부분 일치로 검사(대소문자 무시).
# 목록에 없는 성분은 기본값(DEFAULT_ALPHA)을 씀.
INGREDIENT_RISK_ALPHA = {
    "레티놀": 3.0,
    "레티날": 3.0,
    "레티노": 2.5,
    "살리실산": 2.5,
    "bha": 2.5,
    "aha": 2.0,
    "글라이콜릭애씨드": 2.0,
    "락틱애씨드": 1.8,
    "향료": 2.0,
    "프래그런스": 2.0,
    "변성알코올": 2.0,
    "에탄올": 1.5,
    "벤조일퍼옥사이드": 2.5,
}
DEFAULT_ALPHA = 1.0

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
    "같은 물리적 영역"을 묻는 범용 헬퍼 — products.py의 추천 필터 등 여러 곳에서 씀.
    트러블 bad/neutral/good 분류에는 이거 대신 아래 _bad_zone_set_for_dot()을 씀(형제 서브존을
    bad로 뭉치면 안 되므로 다름 — §0 참고)."""
    related = {zone}
    if zone in SUB_TO_PARENT:
        related.add(SUB_TO_PARENT[zone])
    if zone in SUB_ZONES:
        related.update(SUB_ZONES[zone])
    return related


def _bad_zone_set_for_dot(zone: str) -> set[str]:
    """트러블이 찍힌 부위의 "진짜 bad 영역" — 자신 + (서브존이면) 상위부위만.
    형제 서브존(예: 왼쪽 이마 트러블일 때 오른쪽 이마)은 여기 안 들어감 — Neutral로 따로 분류돼서
    대조군(good) 오염도, 억울한 bad 처리도 안 되게 함. 상위부위 자체에 트러블이 찍히면(서브존 구분 없이
    기록된 경우) 모든 서브존이 물리적으로 같은 영역이라 전부 bad에 포함."""
    s = {zone}
    if zone in SUB_TO_PARENT:
        s.add(SUB_TO_PARENT[zone])
    elif zone in SUB_ZONES:
        s.update(SUB_ZONES[zone])
    return s


def _is_stopword(ingredient: str) -> bool:
    return any(kw in ingredient for kw in STOPWORD_INGREDIENTS)


def _risk_alpha(ingredient: str) -> float:
    lowered = ingredient.lower()
    for kw, alpha in INGREDIENT_RISK_ALPHA.items():
        if kw.lower() in lowered:
            return alpha
    return DEFAULT_ALPHA


def _order_weight(index: int, total: int) -> float:
    """전성분 순위 가중치 — 앞쪽(고농도)일수록 1.0에 가깝고, 뒤로 갈수록 0.3까지 선형으로 낮아짐."""
    if total <= 1:
        return 1.0
    return round(max(0.3, 1.0 - (index / (total - 1)) * 0.7), 3)


def analyze(db: Session, profile_id: int, dot_type: str | None = None) -> dict:
    dots_query = db.query(TroubleDot).filter(TroubleDot.profile_id == profile_id)
    if dot_type:
        dots_query = dots_query.filter(TroubleDot.type == dot_type)
    dots = dots_query.all()
    if not dots:
        return {
            "bad_zones": [],
            "neutral_zones": [],
            "good_zones": ZONES,
            "events": 0,
            "suspects": [],
            "message": "아직 트러블 기록이 없어요. '트러블 표시'에서 발생 위치를 먼저 남겨주세요 — 비교할 부위가 있어야 원인을 좁힐 수 있어요.",
            "confidence": "low",
            "confidence_message": _CONFIDENCE_MESSAGES["low"],
            "days_tracked": 0,
            "external_insight": None,
        }

    # 1단계: 부위 3분할 — Bad(트러블 직접 부위) / Neutral(형제 서브존, 대조군에서 제외) / Good(나머지)
    bad_zones_set: set[str] = set()
    neutral_zones_set: set[str] = set()
    for dot in dots:
        bad_zones_set.update(_bad_zone_set_for_dot(dot.zone))
        parent = SUB_TO_PARENT.get(dot.zone)
        if parent:
            neutral_zones_set.update(SUB_ZONES[parent])
    neutral_zones_set -= bad_zones_set

    bad_zones = sorted(bad_zones_set)
    neutral_zones = sorted(neutral_zones_set)
    good_zones = [z for z in ZONES if z not in bad_zones_set and z not in neutral_zones_set]

    products = {p.id: p for p in db.query(Product).filter(Product.profile_id == profile_id).all()}

    # ingredient -> 집계. count/zones/time_slots/product_ids는 기존 프론트 호환용, order_weights/collisions는 신규 계산용
    hits: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "zones": set(), "time_slots": set(), "product_ids": set(), "order_weights": []}
    )

    for dot in dots:
        window_start = dot.date - timedelta(days=LAG_DAYS)
        bad_set_for_this_dot = _bad_zone_set_for_dot(dot.zone)
        entries = (
            db.query(DailyLog)
            .filter(
                DailyLog.profile_id == profile_id,
                DailyLog.zone.in_(bad_set_for_this_dot),
                DailyLog.date >= window_start,
                DailyLog.date <= dot.date,
            )
            .all()
        )

        # 5단계용: 같은 날짜/부위/시간대에 같이 발린 성분끼리 묶어서 화학적 상성 충돌 체크
        by_slot: dict[tuple, list[str]] = defaultdict(list)
        for entry in entries:
            product = products.get(entry.product_id)
            if product:
                by_slot[(entry.date, entry.zone, entry.time_slot)].extend(product.ingredients)

        for entry in entries:
            product = products.get(entry.product_id)
            if not product:
                continue
            same_slot_ingredients = set(by_slot[(entry.date, entry.zone, entry.time_slot)])
            collisions = check_interactions(same_slot_ingredients)

            for idx, ing in enumerate(product.ingredients):
                if _is_stopword(ing):
                    continue
                h = hits[ing]
                h["count"] += 1
                h["zones"].add(dot.zone)
                h["time_slots"].add(entry.time_slot)
                h["product_ids"].add(product.id)
                h["order_weights"].append(_order_weight(idx, len(product.ingredients)))

                relevant = [c for c in collisions if c["a"] == ing or c["b"] == ing]
                if relevant:
                    existing = h.setdefault("collisions", [])
                    for c in relevant:
                        if not any(x["a"] == c["a"] and x["b"] == c["b"] for x in existing):
                            existing.append(c)

    # 3단계 분모: 이 프로필이 전체 기간·전체 부위에 걸쳐 이 성분을 몇 번이나 썼는지(정지어 제외)
    total_counts: dict[str, int] = defaultdict(int)
    for entry in db.query(DailyLog).filter(DailyLog.profile_id == profile_id).all():
        product = products.get(entry.product_id)
        if not product:
            continue
        for ing in product.ingredients:
            if not _is_stopword(ing):
                total_counts[ing] += 1

    suspects = []
    for ing, h in hits.items():
        total = max(total_counts.get(ing, h["count"]), h["count"])
        exposure_ratio = round(h["count"] / total, 2) if total else 0.0
        alpha = _risk_alpha(ing)
        avg_order_weight = round(sum(h["order_weights"]) / len(h["order_weights"]), 3) if h["order_weights"] else 1.0
        score = round(h["count"] * exposure_ratio * alpha * avg_order_weight, 3)
        suspects.append({
            "ingredient": ing,
            "count": h["count"],
            "zones": sorted(h["zones"]),
            "time_slots": sorted(h["time_slots"]),
            "product_ids": sorted(h["product_ids"]),
            "exposure_ratio": exposure_ratio,
            "risk_alpha": alpha,
            "order_weight": avg_order_weight,
            "score": score,
            "collision_warnings": h.get("collisions", []),
        })
    suspects.sort(key=lambda s: s["score"], reverse=True)

    # 기록 기간 파악 (트러블/도포 기록 중 가장 이른 날짜 기준) — 신뢰도 등급의 기준이 됨(§1)
    log_dates = [r[0] for r in db.query(DailyLog.date).filter(DailyLog.profile_id == profile_id).all()]
    all_dates = [d.date for d in dots] + log_dates
    days_tracked = (Date.today() - min(all_dates)).days + 1 if all_dates else 0

    if days_tracked < CONFIDENCE_LOW_THRESHOLD:
        confidence = "low"
    elif days_tracked < CONFIDENCE_HIGH_THRESHOLD:
        confidence = "medium"
    else:
        confidence = "high"

    if not good_zones:
        message = "모든 부위에 트러블이 나서 비교할 '깨끗한 부위'가 없어요. 이 상태에서는 원인 성분을 좁히기 어려워요 — 안 난 부위가 생기면 훨씬 정확해집니다."
    elif not suspects:
        message = "트러블 난 부위에만 발린 성분을 찾지 못했어요. 성분 외 원인(수면 부족, 마찰, 호르몬 변화 등)일 수 있어요."
    else:
        message = f"{days_tracked}일간의 기록을 바탕으로 분석했어요."

    return {
        "bad_zones": bad_zones,
        "neutral_zones": neutral_zones,
        "good_zones": good_zones,
        "events": len(dots),
        "suspects": suspects,
        "message": message,
        "confidence": confidence,
        "confidence_message": _CONFIDENCE_MESSAGES[confidence],
        "days_tracked": days_tracked,
        "external_insight": _external_factor_insight(db, profile_id, dots),
    }
