import os

from openai import OpenAI

_client: OpenAI | None = None

# AI_ENABLED 환경변수(render.yaml)가 배포 시점의 기본값을 정하고, MY 화면의 즉시 토글
# (backend/routers/settings.py)이 이 인메모리 값을 재배포 없이 바로 덮어씀. 서버가 재시작
# 되면(콜드스타트 등) main.py가 DB(app_settings)에 저장된 마지막 토글 값으로 다시 덮어써서
# 스위치로 꺼둔 상태가 재시작 후에도 유지되게 함 — DB에 값이 아예 없을 때만 이 환경변수
# 기본값이 그대로 씀.
_enabled = os.environ.get("AI_ENABLED", "true").strip().lower() != "false"


def is_ai_enabled() -> bool:
    return _enabled


def set_ai_enabled(value: bool) -> None:
    global _enabled
    _enabled = value


def get_client() -> OpenAI:
    if not _enabled:
        raise RuntimeError("AI 기능이 꺼져있습니다")
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다")
        _client = OpenAI(api_key=api_key)
    return _client
