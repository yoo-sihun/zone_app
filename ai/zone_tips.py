import json

from .client import get_client

PROMPT_TEMPLATE = """당신은 피부과학 지식을 갖춘 스킨케어 어시스턴트입니다.
아래는 사용자 얼굴의 부위별 최근 트러블 상태 요약입니다(부위명, 상태, 트러블 건수, 그 부위에
자주 발린 의심 성분 목록).

부위 목록(JSON): {items_json}

각 부위마다 관리 팁을 한국어로 1문장, 40자 내외로 작성하세요. 의료적 진단이 아니라 참고용
팁이니 과장하지 말고 실용적으로 쓰세요. "양호" 상태면 칭찬 톤으로, "주의" 상태면 구체적인
다음 행동(성분 점검, 실험 등)을 제안하는 톤으로 써주세요.

아래 JSON 형식으로만 응답하세요. 다른 설명은 붙이지 마세요.
{{"tips": [{{"zone": "부위 코드", "tip": "팁 문장"}}]}}
목록에 없는 부위를 새로 만들어내지 말고, 주어진 부위 전부에 대해 하나씩만 반환하세요.
"""


def generate_zone_tips(zone_summaries: list[dict]) -> dict[str, str]:
    """zone_summaries: [{"zone": ..., "zone_label": ..., "status": ..., "count": ..., "suspects": [...]}, ...]
    반환: {zone: tip}. 실패하면 빈 dict — 호출부가 고정 문구로 폴백해야 함."""
    if not zone_summaries:
        return {}
    try:
        client = get_client()
        prompt = PROMPT_TEMPLATE.replace("{items_json}", json.dumps(zone_summaries, ensure_ascii=False))
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
