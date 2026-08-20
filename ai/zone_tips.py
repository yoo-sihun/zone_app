import json

from .client import get_client

PROMPT_TEMPLATE = """당신은 피부과학 지식을 갖춘 스킨케어 어시스턴트입니다.
아래는 사용자 얼굴의 부위별 최근 트러블 상태 요약입니다(부위명, 상태, 트러블 건수, 그 부위에
자주 발린 의심 성분 목록, 그 부위에서 함께 쓰인 성분 중 상성이 안 좋은 조합이 있다면 collisions).

부위 목록(JSON): {items_json}
{weather_block}
각 부위마다 관리 팁을 한국어로 1문장, 40자 내외로 작성하세요.

중요 — 반드시 지킬 것(의료법·화장품법 준수):
- 이것은 의료 진단/치료가 아니라 기록 기반 참고용 가이드입니다. "진단", "질환", "OO염",
  "치료", "완치" 같은 의학적 확정 표현이나 "여드름 치료" 같은 의약품 효능 표현을 쓰지 마세요.
- "피부 장벽 보습에 도움", "피부 진정 케어" 처럼 화장품 기능 범위 안에서만 서술하세요.
- "양호" 상태면 칭찬 톤으로, "주의" 상태면 구체적인 다음 행동(성분 점검, 실험 등)을
  제안하는 톤으로 써주세요. 과장하지 말고 실용적으로 쓰세요.
- 해당 부위에 collisions 정보가 있다면, 그 성분들을 함께 바르지 말고 아침/저녁으로
  나누거나 격일로 쓰라는 구체적 사용법 안내를 팁에 반드시 녹이세요.
- 날씨 정보가 주어졌다면(습도가 낮음/자외선이 높음 등) 그에 맞는 팁을 우선 반영하세요
  (예: 습도 낮음 → 수분 밀폐형 보습 팁, 자외선 높음 → 무기자차 중심 팁).

아래 JSON 형식으로만 응답하세요. 다른 설명은 붙이지 마세요.
{{"tips": [{{"zone": "부위 코드", "tip": "팁 문장"}}]}}
목록에 없는 부위를 새로 만들어내지 말고, 주어진 부위 전부에 대해 하나씩만 반환하세요.
"""


def generate_zone_tips(zone_summaries: list[dict], weather: dict | None = None) -> dict[str, str]:
    """zone_summaries: [{"zone": ..., "zone_label": ..., "status": ..., "count": ..., "suspects": [...],
    "collisions": [{"a":..., "b":..., "description":...}, ...]}, ...]
    weather: {"humidity": float|None, "uv_index": float|None} 또는 None — 있으면 상황별 팁에 반영.
    반환: {zone: tip}. 실패하면 빈 dict — 호출부가 고정 문구로 폴백해야 함."""
    if not zone_summaries:
        return {}
    try:
        client = get_client()
        weather_block = ""
        if weather and (weather.get("humidity") is not None or weather.get("uv_index") is not None):
            weather_block = f"\n오늘 날씨: 습도 {weather.get('humidity')}%, 자외선지수 {weather.get('uv_index')}\n"
        prompt = PROMPT_TEMPLATE.replace("{items_json}", json.dumps(zone_summaries, ensure_ascii=False))
        prompt = prompt.replace("{weather_block}", weather_block)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=700,
        )
        data = json.loads(resp.choices[0].message.content)
        tips = data.get("tips", [])
        if not isinstance(tips, list):
            return {}
        return {
            t["zone"]: t["tip"]
            for t in tips
            if isinstance(t, dict) and t.get("zone") and t.get("tip")
        }
    except Exception:
        return {}
