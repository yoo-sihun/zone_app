import base64
import json

from .client import get_client

PROMPT = """이 이미지는 화장품 제품의 성분표(또는 제품 패키지) 사진입니다.
다음 JSON 형식으로만 응답하세요. 다른 설명은 붙이지 마세요.

{"name": "제품명(모르면 빈 문자열)", "ingredients": ["성분1", "성분2", ...]}

- 성분은 전성분표에 적힌 순서대로, 쉼표로 구분된 항목을 그대로 배열에 담으세요.
- 사진이 흐릿해서 읽을 수 없는 글자는 억지로 추측하지 말고 건너뛰세요.
- 성분표를 전혀 찾을 수 없으면 ingredients를 빈 배열로 반환하세요.
"""


def extract_ingredients(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    client = get_client()
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
                ],
            }
        ],
        response_format={"type": "json_object"},
        max_tokens=1000,
    )
    content = resp.choices[0].message.content
    data = json.loads(content)
    return {
        "name": data.get("name", "") or "",
        "ingredients": [i.strip() for i in data.get("ingredients", []) if i.strip()],
    }
