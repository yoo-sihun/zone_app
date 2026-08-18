import os
from datetime import date as Date
from urllib.parse import quote

import httpx

STATION_NAME = os.environ.get("AIRKOREA_STATION", "종로구")

BASE_URL = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"


def _service_key() -> str:
    key = os.environ.get("AIRKOREA_API_KEY")
    if not key:
        raise RuntimeError("AIRKOREA_API_KEY 환경변수가 설정되어 있지 않습니다")
    return key


def fetch_pm25(target_date: Date) -> float | None:
    """target_date의 PM2.5 시간별 값 평균을 에어코리아에서 가져옴. 데이터 없으면 None."""
    days_ago = (Date.today() - target_date).days
    if days_ago < 0:
        return None
    if days_ago <= 1:
        data_term, num_of_rows = "DAILY", 25
    elif days_ago <= 31:
        data_term, num_of_rows = "MONTH", 744
    else:
        data_term, num_of_rows = "3MONTH", 2232

    # serviceKey는 이미 URL 인코딩된 값이라 그대로 이어붙임 — httpx params로 넘기면 이중 인코딩됨
    url = (
        f"{BASE_URL}?serviceKey={_service_key()}"
        f"&returnType=json&numOfRows={num_of_rows}&pageNo=1"
        f"&stationName={quote(STATION_NAME)}&dataTerm={data_term}&ver=1.3"
    )
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    items = resp.json().get("response", {}).get("body", {}).get("items", [])

    target_str = target_date.isoformat()
    values: list[float] = []
    for item in items:
        if not str(item.get("dataTime", "")).startswith(target_str):
            continue
        raw = item.get("pm25Value")
        if raw and raw != "-":
            try:
                values.append(float(raw))
            except ValueError:
                pass

    if not values:
        return None
    return round(sum(values) / len(values), 1)
