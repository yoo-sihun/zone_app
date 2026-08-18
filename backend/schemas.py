from datetime import date as Date
from pydantic import BaseModel


class ProductIn(BaseModel):
    name: str
    ingredients: list[str]


class ProductOut(BaseModel):
    id: int
    name: str
    ingredients: list[str]

    class Config:
        from_attributes = True


class OcrResult(BaseModel):
    name: str
    ingredients: list[str]


class LogToggleIn(BaseModel):
    date: Date
    zone: str
    product_id: int


class DotIn(BaseModel):
    date: Date
    zone: str
    x: float
    y: float


class DaySnapshot(BaseModel):
    date: Date
    log: dict[str, list[int]]  # zone -> [product_id...]
    dots: list[dict]  # [{id, zone, x, y}]


class Suspect(BaseModel):
    ingredient: str
    count: int
    zones: list[str]
    product_ids: list[int]


class AnalysisOut(BaseModel):
    bad_zones: list[str]
    good_zones: list[str]
    events: int
    suspects: list[Suspect]
