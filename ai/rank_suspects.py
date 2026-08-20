import json

from .client import get_client

PROMPT_TEMPLATE = """당신은 화장품 성분 지식을 갖춘 피부과학 어시스턴트입니다.
아래는 사용자의 실제 스킨케어 기록을 분석해서, 트러블이 난 부위에서만 발견되고 트러블이 안 난 부위에서는
안 쓰인 "의심 성분" 목록입니다. 각 성분마다 트러블 발생일 근처에 발린 횟수(count)가 있습니다.

문제: 이 횟수는 단순 빈도라서, 정제수·글리세린처럼 거의 모든 제품에 들어가는 무자극 베이스(기제) 성분이
실제로는 자극과 무관해도 빈도가 높다는 이유만으로 항상 상위에 올라오는 편향이 있습니다.

당신의 역할: 화장품 성분 지식을 바탕으로, 이 목록을 "실제로 트러블을 유발했을 가능성"이 높은 순서로 재정렬하세요.
- 정제수, 글리세린, 다이메티콘, 부틸렌글라이콜, 카보머 등 널리 쓰이는 무자극 베이스 성분은 순위를 낮추세요
  (완전히 제외하지는 말고 맨 아래 쪽으로).
- 레티놀/레티날, AHA·BHA류(살리실산·글라이콜릭애씨드 등), 프래그런스(향료), 에탄올, 특정 방부제,
  에센셜 오일 등 자극·알레르기 유발이 잘 알려진 활성 성분은 순위를 높이세요.
- 빈도(count)도 참고하세요 — 자극 가능성이 비슷하면 빈도 높은 쪽을 더 유력하게 보세요.
- 목록에 없는 성분을 새로 만들어내지 마세요. 반드시 주어진 성분만 사용하고, 전부 빠짐없이 포함하세요.

중요 — reason 작성 시 반드시 지킬 것(의료법 준수):
- 이것은 의료 진단이 아니라 사용자의 기록(도포 패턴)을 통계적으로 비교한 결과입니다.
- "진단", "질환", "OO염", "치료", "완치" 같은 의학적 확정 표현을 절대 쓰지 마세요.
- 대신 "기록상 노출 빈도가 높음", "자극 유발 가능성이 알려진 성분" 처럼 기록/가능성 기반으로 서술하세요.
- 단정("원인입니다")이 아니라 가능성("~일 가능성이 있어요", "~로 추정돼요") 표현만 쓰세요.

성분 목록(JSON): {items_json}

아래 JSON 형식으로만 응답하세요. 다른 설명은 붙이지 마세요.
{{"ranked": [{{"ingredient": "성분명", "reason": "한 줄 설명(한국어, 30자 내외)"}}]}}
ranked 배열의 순서가 곧 우선순위입니다(맨 앞이 가장 유력).
"""


def rank_suspects(suspects: list[dict]) -> tuple[list[dict], bool]:
    """의심 성분 목록을 성분 지식 기반으로 재정렬.
    성공하면 (재정렬된 리스트, True), 실패하면 (원래 리스트, False) 반환 — 핵심 분석 기능이
    AI 실패로 죽지 않도록 항상 폴백함."""
    if not suspects:
        return suspects, False

    try:
        client = get_client()
        items = [{"ingredient": s["ingredient"], "count": s["count"]} for s in suspects]
        prompt = PROMPT_TEMPLATE.replace("{items_json}", json.dumps(items, ensure_ascii=False))
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1000,
        )
        data = json.loads(resp.choices[0].message.content)
        ranked = data.get("ranked", [])
        if not isinstance(ranked, list):
            return suspects, False
    except Exception:
        return suspects, False

    by_ingredient = {s["ingredient"]: s for s in suspects}
    reordered = []
    seen = set()
    for item in ranked:
        name = item.get("ingredient") if isinstance(item, dict) else None
        if name in by_ingredient and name not in seen:
            s = dict(by_ingredient[name])
            s["ai_reason"] = item.get("reason")
            reordered.append(s)
            seen.add(name)

    # AI가 누락한 성분은 원래 순서 그대로 뒤에 붙여서 절대 빠지지 않게 함
    for s in suspects:
        if s["ingredient"] not in seen:
            reordered.append(dict(s, ai_reason=None))

    return reordered, True
