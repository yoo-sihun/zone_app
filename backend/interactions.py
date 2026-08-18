"""Static lookup of ingredient combinations worth a caution — not a DB table,
just reference data maintained in code (see CLAUDE.md §5 for why)."""

INGREDIENT_INTERACTIONS = [
    {
        "a": "비타민C",
        "b": "레티놀",
        "severity": "caution",
        "description": "동시 사용 시 피부 자극이 커질 수 있어요. 아침/저녁으로 나눠 바르는 걸 권장합니다.",
    },
    {
        "a": "AHA",
        "b": "레티놀",
        "severity": "avoid",
        "description": "각질 제거 효과가 겹쳐 자극·홍조 위험이 높습니다.",
    },
    {
        "a": "BHA",
        "b": "레티놀",
        "severity": "avoid",
        "description": "각질 제거 효과가 겹쳐 자극·홍조 위험이 높습니다.",
    },
    {
        "a": "벤조일퍼옥사이드",
        "b": "레티놀",
        "severity": "avoid",
        "description": "레티놀을 산화시켜 효과를 떨어뜨리고 자극을 유발할 수 있습니다.",
    },
    {
        "a": "비타민C",
        "b": "나이아신아마이드",
        "severity": "caution",
        "description": "낮은 pH에서 만나면 일시적으로 홍조를 유발할 수 있습니다(대부분 제품에서는 문제없음).",
    },
    {
        "a": "AHA",
        "b": "BHA",
        "severity": "caution",
        "description": "각질 제거 성분을 동시에 고농도로 사용하면 자극이 커질 수 있습니다.",
    },
]


def check_interactions(ingredients: set[str]) -> list[dict]:
    return [
        pair
        for pair in INGREDIENT_INTERACTIONS
        if pair["a"] in ingredients and pair["b"] in ingredients
    ]
