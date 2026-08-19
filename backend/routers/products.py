from datetime import date as Date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from openai import OpenAIError
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_profile_id
from ..models import DailyLog, Product, SuspectIngredient
from ..schemas import ProductIn, ProductOut, ProductCreateOut, OcrResult
from ..experiments import locked_ingredient
from ..analysis import _related_zones


def _last_used_map(db: Session, profile_id: int) -> dict[int, Date]:
    """product_id -> 가장 최근 발린 날짜. 한 번도 안 쓴 제품은 이 맵에 없음(= None 처리)."""
    rows = (
        db.query(DailyLog.product_id, func.max(DailyLog.date))
        .filter(DailyLog.profile_id == profile_id)
        .group_by(DailyLog.product_id)
        .all()
    )
    return {product_id: last_date for product_id, last_date in rows}

# Product에 아직 source 컬럼은 없음 — 지금은 화장대(본인 등록) 제품만 취급.
# 나중에 실제 B2B 제휴로 외부 카탈로그가 생기면, recommended_products가 두 소스를 합쳐서
# 반환하도록 확장하되 응답 형태(ProductOut)는 유지할 것.

from ai.ocr import extract_ingredients

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)):
    """최근 사용한 순서로 정렬 — 한 번도 안 쓴 제품은 맨 뒤(등록 순)."""
    locked_ing = locked_ingredient(db, profile_id, Date.today())
    last_used = _last_used_map(db, profile_id)
    products = db.query(Product).filter(Product.profile_id == profile_id).all()

    def sort_key(p):
        used = last_used.get(p.id)
        return (used is None, -used.toordinal() if used else 0)

    products.sort(key=sort_key)
    return [
        {
            "id": p.id,
            "name": p.name,
            "ingredients": p.ingredients,
            "category": p.category,
            "locked": bool(locked_ing and locked_ing in p.ingredients),
            "last_used": last_used.get(p.id),
        }
        for p in products
    ]


@router.get("/recommended", response_model=list[ProductOut])
def recommended_products(
    zone: str | None = None, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    """화장대에 등록된 제품 기반 추천 — 별도 추천 엔진/외부 카탈로그 없이 본인 제품만.
    zone 없으면: 오늘 아직 하나도 안 바른 제품(기존 홈 화면용 동작, 그대로 유지).
    zone 있으면: 그 부위엔 아직 안 바른 제품 중, 의심 성분 든 것과 잠긴(실험 중) 것은 제외."""
    today = Date.today()
    log_query = db.query(DailyLog.product_id).filter(DailyLog.profile_id == profile_id, DailyLog.date == today)
    if zone:
        # 트러블/도포 기록 매칭 버그(§0)와 같은 클래스 — 서브존으로 기록된 도포를
        # 상위부위 필터가 못 찾는 걸 막기 위해 자신+상위부위+서브존 전부로 확장해서 비교
        log_query = log_query.filter(DailyLog.zone.in_(_related_zones(zone)))
    applied_ids = {r[0] for r in log_query.all()}

    locked_ing = locked_ingredient(db, profile_id, today)
    products = db.query(Product).filter(Product.profile_id == profile_id).all()
    remaining = [p for p in products if p.id not in applied_ids]

    if zone:
        suspects = {
            s.ingredient
            for s in db.query(SuspectIngredient).filter(SuspectIngredient.profile_id == profile_id).all()
        }
        remaining = [
            p for p in remaining
            if not any(ing in suspects for ing in p.ingredients)
            and not (locked_ing and locked_ing in p.ingredients)
        ]

    return [
        {
            "id": p.id,
            "name": p.name,
            "ingredients": p.ingredients,
            "category": p.category,
            "locked": bool(locked_ing and locked_ing in p.ingredients),
        }
        for p in remaining[:6]
    ]


@router.post("", response_model=ProductCreateOut)
def create_product(
    data: ProductIn, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    product = Product(profile_id=profile_id, name=data.name, ingredients=data.ingredients, category=data.category)
    db.add(product)
    db.commit()
    db.refresh(product)

    suspects = {
        s.ingredient for s in db.query(SuspectIngredient).filter(SuspectIngredient.profile_id == profile_id).all()
    }
    warnings = [ing for ing in product.ingredients if ing in suspects]
    return {
        "id": product.id, "name": product.name, "ingredients": product.ingredients,
        "category": product.category, "warnings": warnings,
    }


@router.patch("/{product_id}", response_model=ProductCreateOut)
def update_product(
    product_id: int,
    data: ProductIn,
    profile_id: int = Depends(get_current_profile_id),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.profile_id == profile_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="제품을 찾을 수 없습니다")
    product.name = data.name
    product.ingredients = data.ingredients
    product.category = data.category
    db.commit()
    db.refresh(product)

    suspects = {
        s.ingredient for s in db.query(SuspectIngredient).filter(SuspectIngredient.profile_id == profile_id).all()
    }
    warnings = [ing for ing in product.ingredients if ing in suspects]
    return {
        "id": product.id, "name": product.name, "ingredients": product.ingredients,
        "category": product.category, "warnings": warnings,
    }


@router.delete("/{product_id}")
def delete_product(
    product_id: int, profile_id: int = Depends(get_current_profile_id), db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id, Product.profile_id == profile_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="제품을 찾을 수 없습니다")
    db.delete(product)
    db.commit()
    return {"ok": True}


@router.post("/ocr", response_model=OcrResult)
async def ocr_product(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일을 업로드해주세요")
    image_bytes = await file.read()
    try:
        result = extract_ingredients(image_bytes, mime_type=file.content_type)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except OpenAIError as e:
        raise HTTPException(status_code=502, detail=f"OCR 인식 실패: {e}")
    return result
