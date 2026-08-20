"""AI 기능 전역 켜기/끄기 — Render 재배포 없이 즉시 반영되는 인메모리 플래그.
실제 값은 backend/routers/settings.py가 DB(app_settings 테이블)에 저장해서
서버 재시작 후에도 유지되고, main.py가 시작 시점에 이 값을 불러와 초기화함."""

_enabled = True


def is_enabled() -> bool:
    return _enabled


def set_enabled(value: bool) -> None:
    global _enabled
    _enabled = value
