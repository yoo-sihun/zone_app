import os

from openai import OpenAI

_client: OpenAI | None = None


def _ai_enabled() -> bool:
    """render.yaml(또는 로컬 .env)의 AI_ENABLED로 켜고 끔 — 값을 바꾸면 재배포/재시작해야
    반영됨(true 이외의 값은 전부 꺼짐으로 취급, 기본값은 켜짐)."""
    return os.environ.get("AI_ENABLED", "true").strip().lower() != "false"


def get_client() -> OpenAI:
    if not _ai_enabled():
        raise RuntimeError("AI 기능이 꺼져있습니다 (AI_ENABLED=false)")
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다")
        _client = OpenAI(api_key=api_key)
    return _client
