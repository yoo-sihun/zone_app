from sqlalchemy import Column, Integer, String, Date, ForeignKey, JSON, Float, UniqueConstraint

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
