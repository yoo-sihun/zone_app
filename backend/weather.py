import os
from datetime import date as Date


def fetch_humidity_uv(target_date: Date) -> dict:
    """기상청(KMA) 습도/자외선지수 연동 자리만 만들어둔 스캐폴드.
    실제 API 키(KMA_API_KEY)와 정확한 엔드포인트/파라미터는 아직 확정 전 —
    키가 준비되면 이 함수 안만 채우면 됨(호출부는 안 바꿔도 됨)."""
    key = os.environ.get("KMA_API_KEY")
    if not key:
        raise RuntimeError("KMA_API_KEY 환경변수가 설정되어 있지 않습니다 (기상청 API 연동 준비 중)")
    raise RuntimeError("기상청 API 연동이 아직 구현되지 않았습니다")
