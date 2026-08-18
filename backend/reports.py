import io
import os
from datetime import date as Date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from .models import DailyLog, TroubleDot, Product, SuspectIngredient, ZONE_LABELS, TROUBLE_TYPE_LABELS

FONT_NAME = "NanumSquare"
FONT_PATH = os.path.join(os.path.dirname(__file__), "fonts", "NanumSquareR.ttf")

if FONT_NAME not in pdfmetrics.getRegisteredFontNames():
    pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))


def _table(rows: list[list[str]]) -> Table:
    table = Table(rows, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def generate_report_pdf(db: Session, start: Date, end: Date) -> bytes:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleKR", parent=styles["Title"], fontName=FONT_NAME)
    h2_style = ParagraphStyle("H2KR", parent=styles["Heading2"], fontName=FONT_NAME)
    body_style = ParagraphStyle("BodyKR", parent=styles["BodyText"], fontName=FONT_NAME)
    disc_style = ParagraphStyle("DiscKR", parent=styles["BodyText"], fontName=FONT_NAME, fontSize=8, textColor=colors.grey)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    story = []

    story.append(Paragraph(f"ZONE 리포트 ({start.isoformat()} ~ {end.isoformat()})", title_style))
    story.append(Spacer(1, 14))

    dots = (
        db.query(TroubleDot)
        .filter(TroubleDot.date >= start, TroubleDot.date <= end)
        .order_by(TroubleDot.date)
        .all()
    )
    story.append(Paragraph(f"트러블 발생 현황 ({len(dots)}건)", h2_style))
    story.append(Spacer(1, 6))
    if dots:
        rows = [["날짜", "부위", "유형"]]
        for d in dots:
            rows.append(
                [d.date.isoformat(), ZONE_LABELS.get(d.zone, d.zone), TROUBLE_TYPE_LABELS.get(d.type, d.type)]
            )
        story.append(_table(rows))
    else:
        story.append(Paragraph("해당 기간 트러블 기록이 없습니다.", body_style))
    story.append(Spacer(1, 18))

    logs = (
        db.query(DailyLog)
        .filter(DailyLog.date >= start, DailyLog.date <= end)
        .order_by(DailyLog.date)
        .all()
    )
    products = {p.id: p for p in db.query(Product).all()}
    story.append(Paragraph(f"도포 제품 히스토리 ({len(logs)}건)", h2_style))
    story.append(Spacer(1, 6))
    if logs:
        rows = [["날짜", "시간대", "부위", "제품명"]]
        for entry in logs:
            product = products.get(entry.product_id)
            rows.append(
                [
                    entry.date.isoformat(),
                    "아침" if entry.time_slot == "am" else "저녁",
                    ZONE_LABELS.get(entry.zone, entry.zone),
                    product.name if product else "(삭제된 제품)",
                ]
            )
        story.append(_table(rows))
    else:
        story.append(Paragraph("해당 기간 도포 기록이 없습니다.", body_style))
    story.append(Spacer(1, 18))

    suspects = db.query(SuspectIngredient).all()
    story.append(Paragraph("의심 성분 이력", h2_style))
    story.append(Spacer(1, 6))
    if suspects:
        story.append(Paragraph(", ".join(s.ingredient for s in suspects), body_style))
    else:
        story.append(Paragraph("저장된 의심 성분이 없습니다.", body_style))
    story.append(Spacer(1, 24))

    story.append(
        Paragraph(
            "이 리포트는 의료적 진단이 아니며 참고용입니다. 증상이 지속되면 피부과 전문의와 상담하세요.",
            disc_style,
        )
    )

    doc.build(story)
    return buf.getvalue()
