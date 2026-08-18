from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product
from ..schemas import ProductIn, ProductOut, OcrResult

from ai.ocr import extract_ingredients

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).all()


@router.post("", response_model=ProductOut)
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    product = Product(name=data.name, ingredients=data.ingredients)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


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
