from datetime import date as Date
from pydantic import BaseModel


class ProfileIn(BaseModel):
    name: str


class ProfileOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ProductIn(BaseModel):
    name: str
    ingredients: list[str]


class ProductOut(BaseModel):
    id: int
    name: str
    ingredients: list[str]
    locked: bool = False
    last_used: Date | None = None

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
    time_slot: str  # am | pm
    product_id: int


class DotIn(BaseModel):
    date: Date
    zone: str
    type: str  # comedonal | papule | pustule | redness
    x: float
    y: float


class DaySnapshot(BaseModel):
    date: Date
    log: dict[str, dict[str, list[int]]]  # zone -> time_slot -> [product_id...]
    dots: list[dict]  # [{id, zone, type, x, y}]


class Suspect(BaseModel):
    ingredient: str
    count: int
    zones: list[str]
    time_slots: list[str]
    product_ids: list[int]


class AnalysisOut(BaseModel):
    bad_zones: list[str]
    good_zones: list[str]
    events: int
    suspects: list[Suspect]
    message: str


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


class TodayStatus(BaseModel):
    date: Date
    logged: bool  # 오늘 도포 기록이 하나라도 있는지


class ExternalFactorIn(BaseModel):
    date: Date
    sleep_hours: float | None = None
    menstrual_phase: str | None = None
    memo: str | None = None
    skin_condition: str | None = None


class HistoryDot(BaseModel):
    date: Date
    zone: str
    type: str
    x: float
    y: float


class HistorySummary(BaseModel):
    start: Date
    end: Date
    zone_apply_counts: dict[str, int]
    total_applies: int
    dots: list[HistoryDot]


class ExternalFactorOut(BaseModel):
    date: Date
    sleep_hours: float | None
    menstrual_phase: str | None
    memo: str | None
    pm25: float | None = None
    humidity: float | None = None
    uv_index: float | None = None
    skin_condition: str | None = None

    class Config:
        from_attributes = True
