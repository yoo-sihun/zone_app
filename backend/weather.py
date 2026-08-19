import os
from datetime import date as Date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

KST = ZoneInfo("Asia/Seoul")

NOWCAST_URL = "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst"
UV_URL = "https://apis.data.go.kr/1360000/LivingWthrIdxServiceV5/getUVIdxV5"

# 기상청 격자 좌표(nx, ny) — 기본값은 AIRKOREA_STATION 기본값("종로구")과 같은 지역
NX = int(os.environ.get("KMA_NX", "60"))
NY = int(os.environ.get("KMA_NY", "127"))

# 생활기상지수 지점코드 — 기본값 서울(1100000000)
AREA_NO = os.environ.get("KMA_AREA_NO", "1100000000")


def _base_datetime(now: datetime) -> tuple[str, str]:
    """초단기실황은 매시 40분에 생성됨 — 그 전이면 아직 이번 시간 값이 안 채워졌을 수 있어 이전 시간으로."""
    if now.minute < 45:
        now = now - timedelta(hours=1)
    return now.strftime("%Y%m%d"), now.strftime("%H00")


def _fetch_humidity() -> float | None:
    key = os.environ.get("KMA_API_KEY")
    if not key:
        raise RuntimeError("KMA_API_KEY 환경변수가 설정되어 있지 않습니다")

    base_date, base_time = _base_datetime(datetime.now(KST))
    resp = httpx.get(
        NOWCAST_URL,
        params={
            "pageNo": 1,
            "numOfRows": 100,
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": NX,
            "ny": NY,
            "authKey": key,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") != "00":
        raise RuntimeError(f"기상청 초단기실황 API 오류: {header.get('resultMsg', '알 수 없는 오류')}")

    items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
    for item in items:
        if item.get("category") == "REH":
            try:
                return float(item["obsrValue"])
            except (KeyError, TypeError, ValueError):
                return None
    return None


def _round_down_3h(dt: datetime) -> datetime:
    return dt.replace(hour=(dt.hour // 3) * 3, minute=0, second=0, microsecond=0)


def _fetch_uv_index() -> float | None:
    """생활기상지수(자외선지수조회, getUVIdxV5)로 현재 자외선지수를 가져옴.
    3시간 단위로 발표되는 예보라 발표시간을 현재시각 기준으로 내림해서 조회하고,
    그 시점(h0)의 값을 씀 — 아직 발표 전이면 이전 발표시간으로 최대 3번 재시도."""
    key = os.environ.get("KMA_UV_API_KEY")
    if not key:
        raise RuntimeError("KMA_UV_API_KEY 환경변수가 설정되어 있지 않습니다")

    candidate = _round_down_3h(datetime.now(KST))
    # ServiceKey는 이미 URL 인코딩된 값이라 그대로 이어붙임 — httpx params로 넘기면 이중 인코딩됨(에어코리아와 동일)
    for _ in range(4):
        time_str = candidate.strftime("%Y%m%d%H")
        url = (
            f"{UV_URL}?ServiceKey={key}"
            f"&pageNo=1&numOfRows=5&dataType=JSON&areaNo={AREA_NO}&time={time_str}"
        )
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        header = data.get("response", {}).get("header", {})
        if header.get("resultCode") == "00":
            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            if items:
                raw = items[0].get("h0")
                if raw not in (None, ""):
                    try:
                        return float(raw)
                    except ValueError:
                        pass
        candidate -= timedelta(hours=3)
    return None


def fetch_humidity_uv(target_date: Date) -> dict:
    """오늘의 습도(기상청 초단기실황) + 자외선지수(생활기상지수)를 가져옴.
    둘 다 관측/예보 시점 기준 값이라 과거 날짜는 지원 안 함 — 에어코리아 PM2.5처럼 기간별 조회가 아님."""
    if target_date != Date.today():
        raise ValueError("오늘 날짜만 지원합니다")

    humidity = _fetch_humidity()
    try:
        uv_index = _fetch_uv_index()
    except RuntimeError:
        uv_index = None  # KMA_UV_API_KEY 없으면 습도만이라도 채워줌

    return {"humidity": humidity, "uv_index": uv_index}
