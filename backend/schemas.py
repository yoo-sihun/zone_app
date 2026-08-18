from datetime import date as Date
from pydantic import BaseModel


class ProductIn(BaseModel):
    name: str
    ingredients: list[str]


class ProductOut(BaseModel):
    id: int
    name: str
    ingredients: list[str]
    locked: bool = False

    class Config:
        from_attributes = True


class ProductCreateOut(BaseModel):
    id: int
    name: str
    ingredients: list[str]
    warnings: list[str] = []  # ingredients that match a saved suspect ingredient


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


class SuspectIn(BaseModel):
    ingredient: str


class SuspectOut(BaseModel):
    id: int
    ingredient: str

    class Config:
        from_attributes = True


class ExperimentIn(BaseModel):
    ingredient: str


class ExperimentOut(BaseModel):
    id: int
    ingredient: str
    start_date: Date
    status: str
    day: int  # 1..EXPERIMENT_DAYS, current progress
    is_complete: bool


class ExperimentResult(ExperimentOut):
    before_count: int
    during_count: int
    improved: bool
