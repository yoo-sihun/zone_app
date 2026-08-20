from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, JSON, Float, Boolean, UniqueConstraint, func

from .database import Base

# 의료법/화장품법 준수용 면책 문구 — 원인분석/실험결과/분석리포트(화면+PDF) 전부 이 한 곳에서만
# 관리(예전엔 프론트 4곳+PDF에 문구가 각각 하드코딩돼있었음). 문구 바꿀 땐 여기만 고치면 됨.
MEDICAL_DISCLAIMER = "본 서비스는 의료적 진단이나 치료를 대신할 수 없으며, 질환 의심 시 피부과 전문의와 상담하세요."

ZONES = [
    "forehead", "rcheek", "lcheek", "nose", "chin",
    "forehead_left", "forehead_right",
    "rcheek_upper", "rcheek_lower", "rcheek_outer",
    "lcheek_upper", "lcheek_lower", "lcheek_outer",
    "nose_bridge", "nose_tip",
    "chin_lip", "chin_jaw"
]
ZONE_LABELS = {
    "forehead": "이마",
    "rcheek": "오른볼",
    "lcheek": "왼볼",
    "nose": "코",
    "chin": "턱·입주변",
    "forehead_left": "이마 왼쪽",
    "forehead_right": "이마 오른쪽",
    "rcheek_upper": "오른볼 상부",
    "rcheek_lower": "오른볼 하부",
    "rcheek_outer": "오른볼 바깥쪽",
    "lcheek_upper": "왼볼 상부",
    "lcheek_lower": "왼볼 하부",
    "lcheek_outer": "왼볼 바깥쪽",
    "nose_bridge": "콧등",
    "nose_tip": "코끝",
    "chin_lip": "입주변",
    "chin_jaw": "턱밑",
}

SUB_ZONES = {
    "forehead": ["forehead_left", "forehead_right"],
    "rcheek": ["rcheek_upper", "rcheek_lower", "rcheek_outer"],
    "lcheek": ["lcheek_upper", "lcheek_lower", "lcheek_outer"],
    "nose": ["nose_bridge", "nose_tip"],
    "chin": ["chin_lip", "chin_jaw"],
}

SUB_TO_PARENT = {
    "forehead_left": "forehead",
    "forehead_right": "forehead",
    "rcheek_upper": "rcheek",
    "rcheek_lower": "rcheek",
    "rcheek_outer": "rcheek",
    "lcheek_upper": "lcheek",
    "lcheek_lower": "lcheek",
    "lcheek_outer": "lcheek",
    "nose_bridge": "nose",
    "nose_tip": "nose",
    "chin_lip": "chin",
    "chin_jaw": "chin",
}

TIME_SLOTS = ["am", "pm"]

TROUBLE_TYPES = ["comedonal", "papule", "pustule", "redness"]
TROUBLE_TYPE_LABELS = {
    "comedonal": "면포성",
    "papule": "붉은 구진",
    "pustule": "화농성",
    "redness": "붉은기",
}


class Profile(Base):
    """A no-password profile — picked from a list, not logged into. All other
    tables scope their rows to one via profile_id."""
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    ingredients = Column(JSON, nullable=False, default=list)  # list[str]
    category = Column(String, nullable=True)  # 자유 문자열(예: "세럼"/"크림"/"선크림") — enum 검증 없음, skin_condition과 같은 패턴


class DailyLog(Base):
    """A product applied to a face zone on a given date, in the AM or PM."""
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    zone = Column(String, nullable=False)
    time_slot = Column(String, nullable=False)  # am | pm
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("profile_id", "date", "zone", "product_id", "time_slot", name="uq_log_entry"),
    )


class TroubleDot(Base):
    """A marked breakout location on a given date, with a lesion type."""
    __tablename__ = "trouble_dots"

    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    zone = Column(String, nullable=False)
    type = Column(String, nullable=False)  # comedonal | papule | pustule | redness
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)


class SuspectIngredient(Base):
    """A user-flagged ingredient — new products get checked against this list."""
    __tablename__ = "suspect_ingredients"

    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    ingredient = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("profile_id", "ingredient", name="uq_suspect_profile_ingredient"),)


class Experiment(Base):
    """An elimination trial: products containing `ingredient` are locked
    for daily_logs dated within [start_date, start_date + duration_days - 1].
    duration_days is chosen per-experiment (3 or 7) — see EXPERIMENT_DAY_OPTIONS."""
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    ingredient = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="active")  # active | completed | stopped
    duration_days = Column(Integer, nullable=False, default=3)
    created_at = Column(DateTime, server_default=func.now())


class ExternalFactor(Base):
    """Per-day context: sleep/menstrual phase/memo/skin_condition are manually entered
    (POST upserts). pm25/humidity/uv_index are fetched on demand (AirKorea / KMA)."""
    __tablename__ = "external_factors"

    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    sleep_hours = Column(Float, nullable=True)
    menstrual_phase = Column(String, nullable=True)
    memo = Column(String, nullable=True)
    pm25 = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    uv_index = Column(Float, nullable=True)
    skin_condition = Column(String, nullable=True)  # 사용자 자가진단, 예: "건성"/"보통"/"유분성"

    __table_args__ = (UniqueConstraint("profile_id", "date", name="uq_external_factor_profile_date"),)


class AppSetting(Base):
    """프로필과 무관한 앱 전역 설정 — 지금은 AI 기능 on/off 하나뿐이라 싱글턴(항상 1행)으로 씀.
    OpenAI 비용이 걱정될 때 Render 재배포 없이 즉시 껐다 켤 수 있게 하려고 추가함(ai/toggle.py)."""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True)
    ai_enabled = Column(Boolean, nullable=False, default=True)
