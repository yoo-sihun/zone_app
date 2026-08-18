from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, JSON, Float, UniqueConstraint, func

from .database import Base

ZONES = ["forehead", "rcheek", "lcheek", "nose", "chin"]
ZONE_LABELS = {
    "forehead": "이마",
    "rcheek": "오른볼",
    "lcheek": "왼볼",
    "nose": "코",
    "chin": "턱·입주변",
}


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    ingredients = Column(JSON, nullable=False, default=list)  # list[str]


class DailyLog(Base):
    """A product applied to a face zone on a given date."""
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False, index=True)
    zone = Column(String, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)

    __table_args__ = (UniqueConstraint("date", "zone", "product_id", name="uq_log_entry"),)


class TroubleDot(Base):
    """A marked breakout location on a given date."""
    __tablename__ = "trouble_dots"

    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False, index=True)
    zone = Column(String, nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)


class SuspectIngredient(Base):
    """A user-flagged ingredient — new products get checked against this list."""
    __tablename__ = "suspect_ingredients"

    id = Column(Integer, primary_key=True)
    ingredient = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())


class Experiment(Base):
    """A 3-day elimination trial: products containing `ingredient` are locked
    for daily_logs dated within [start_date, start_date + EXPERIMENT_DAYS - 1]."""
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True)
    ingredient = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="active")  # active | completed | stopped
    created_at = Column(DateTime, server_default=func.now())
