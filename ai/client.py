import os

from openai import OpenAI

from .toggle import is_enabled

_client: OpenAI | None = None


def get_client() -> OpenAI:
    if not is_enabled():
        raise RuntimeError("AI 기능이 꺼져있습니다")
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다")
        _client = OpenAI(api_key=api_key)
    return _client
