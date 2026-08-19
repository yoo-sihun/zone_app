import base64
import json

from .client import get_client

VALID_TYPES = {"comedonal", "papule", "pustule", "redness"}

PROMPT = """이 사진은 피부에 생긴 트러블(뾰루지·여드름·붉은기) 부위를 찍은 사진입니다.
아래 4가지 유형 중 가장 가까운 것 하나를 골라 다음 JSON 형식으로만 응답하세요. 다른 설명은 붙이지 마세요.

{"type": "comedonal" | "papule" | "pustule" | "redness"}

- comedonal(면포성): 좁쌀 여드름, 블랙헤드/화이트헤드처럼 각질이 막힌 형태
- papule(붉은 구진): 붉고 튀어나왔지만 고름이 뚜렷하게 보이지 않는 형태
- pustule(화농성): 하얗거나 노란 고름이 뚜렷하게 보이는 형태
- redness(붉은기): 뾰루지 없이 피부가 붉게 올라온 상태

판단이 애매해도 4개 중 가장 근접한 값 하나는 반드시 골라 반환하세요.
"""


def classify_trouble(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
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
        max_tokens=50,
    )
    data = json.loads(resp.choices[0].message.content)
    trouble_type = data.get("type")
    return {"type": trouble_type if trouble_type in VALID_TYPES else None}
