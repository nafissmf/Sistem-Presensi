"""Laporan kehadiran."""
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permission
from app.models.auth import User
from app.schemas.common import WebResponse
from app.services import attendance_service as svc

router = APIRouter()


@router.get("/events/{event_id}", response_model=WebResponse[dict])
def event_report(
    event_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_report")),
):
    event, rows = svc.event_report_rows(db, event_id)
    present = sum(1 for row in rows if row["status"] == "Hadir")
    return WebResponse(
        data={
            "event": {"id": event.id, "name": event.name, "event_date": event.event_date.isoformat()},
            "present": present,
            "absent": len(rows) - present,
            "rows": rows,
        }
    )


@router.get("/events/{event_id}/export")
def export_event(
    event_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("export_report")),
):
    filename, content = svc.report_workbook(db, event_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
