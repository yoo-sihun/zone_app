import io
from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..reports import generate_report_pdf

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/pdf")
def get_report_pdf(start: Date, end: Date, db: Session = Depends(get_db)):
    if start > end:
        raise HTTPException(status_code=400, detail="시작일이 종료일보다 늦을 수 없습니다")
    pdf_bytes = generate_report_pdf(db, start, end)
    filename = f"zone-report-{start.isoformat()}_{end.isoformat()}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
