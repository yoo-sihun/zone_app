import os
from datetime import date as Date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

KST = ZoneInfo("Asia/Seoul")

BASE_URL = "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst"

# 기상청 격자 좌표(nx, ny) — 기본값은 AIRKOREA_STATION 기본값("종로구")과 같은 지역
NX = int(os.environ.get("KMA_NX", "60"))
NY = int(os.environ.get("KMA_NY", "127"))


def _base_datetime(now: datetime) -> tuple[str, str]:
    """초단기실황은 매시 40분에 생성됨 — 그 전이면 아직 이번 시간 값이 안 채워졌을 수 있어 이전 시간으로."""
    if now.minute < 45:
        now = now - timedelta(hours=1)
    return now.strftime("%Y%m%d"), now.strftime("%H00")


def fetch_humidity_uv(target_date: Date) -> dict:
    """기상청 초단기실황조회(getUltraSrtNcst)로 현재 습도를 가져옴.
    관측값(nowcast)이라 과거 날짜는 지원 안 함 — 에어코리아 PM2.5처럼 기간별 조회가 아님.
    자외선지수는 이 API엔 없음(별도 생활기상지수 API 필요, 아직 키 없음) — uv_index는 항상 None."""
    key = os.environ.get("KMA_API_KEY")
    if not key:
        raise RuntimeError("KMA_API_KEY 환경변수가 설정되어 있지 않습니다")
    if target_date != Date.today():
        raise ValueError("초단기실황조회는 관측값(nowcast)이라 오늘 날짜만 지원합니다")

    base_date, base_time = _base_datetime(datetime.now(KST))

    resp = httpx.get(
        BASE_URL,
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
        raise RuntimeError(f"기상청 API 오류: {header.get('resultMsg', '알 수 없는 오류')}")

    items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
    humidity = None
    for item in items:
        if item.get("category") == "REH":
            try:
                humidity = float(item["obsrValue"])
            except (KeyError, TypeError, ValueError):
                pass
            break

    return {"humidity": humidity, "uv_index": None}
