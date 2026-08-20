from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import SuspectIngredient
from ..catalog import CATALOG

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/recommended")
def recommended_catalog(profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)):
    """본인이 등록하지 않은 외부 카탈로그 제품 추천 — 화장대 제품 추천(products.py)과 같은
    성분 배제 원칙: 저장해둔 의심 성분이 하나라도 든 제품은 후보에서 제외."""
    suspects = {
        s.ingredient
        for s in db.query(SuspectIngredient).filter(SuspectIngredient.profile_id == profile_id).all()
    }
    return [
        item for item in CATALOG
        if not any(ing in suspects for ing in item["ingredients"])
    ]
