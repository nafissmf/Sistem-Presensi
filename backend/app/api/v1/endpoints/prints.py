"""Cetak kartu barcode."""
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permission
from app.models.auth import User
from app.services import attendance_service as svc

router = APIRouter()


class PrintIn(BaseModel):
    participant_ids: list[str] = Field(min_length=1)
    symbology: str = "code128"


@router.post("/barcode")
def print_barcodes(
    body: PrintIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("print_barcode")),
):
    symbology = "qr" if body.symbology == "qr" else "code128"
    pdf = svc.barcode_pdf(db, body.participant_ids, symbology, user.id)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="barcode-rakernas.pdf"'},
    )
