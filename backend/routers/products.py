from datetime import date as Date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product, SuspectIngredient
from ..schemas import ProductIn, ProductOut, ProductCreateOut, OcrResult
from ..experiments import locked_ingredient

from ai.ocr import extract_ingredients

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    locked_ing = locked_ingredient(db, Date.today())
    products = db.query(Product).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "ingredients": p.ingredients,
            "locked": bool(locked_ing and locked_ing in p.ingredients),
        }
        for p in products
    ]


@router.post("", response_model=ProductCreateOut)
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    product = Product(name=data.name, ingredients=data.ingredients)
    db.add(product)
    db.commit()
    db.refresh(product)

    suspects = {s.ingredient for s in db.query(SuspectIngredient).all()}
    warnings = [ing for ing in product.ingredients if ing in suspects]
    return {"id": product.id, "name": product.name, "ingredients": product.ingredients, "warnings": warnings}


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
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
    return result
