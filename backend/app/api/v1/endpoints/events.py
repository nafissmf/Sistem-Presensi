"""Kegiatan Rakernas."""
from datetime import date, time
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permission
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models.attendance import Attendance, Event, EventParticipant
from app.models.auth import User
from app.schemas.common import WebResponse
from app.services import attendance_service as svc
from app.services.attendance_service import write_audit

router = APIRouter()


class EventIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    event_date: date
    start_time: time
    end_time: time
    location: Optional[str] = None
    status: str = "draft"
    audience: str = "all"
    scan_open_before_min: Optional[int] = None
    scan_close_after_min: Optional[int] = None
    allow_duplicate: bool = False
    color: str = "#4F46E5"
    participant_ids: list[str] = []


def _read(db: Session, event: Event) -> dict:
    data = {
        "id": event.id,
        "name": event.name,
        "event_date": event.event_date.isoformat(),
        "start_time": event.start_time.strftime("%H:%M"),
        "end_time": event.end_time.strftime("%H:%M"),
        "location": event.location,
        "status": event.status,
        "audience": event.audience,
        "scan_open_before_min": event.scan_open_before_min,
        "scan_close_after_min": event.scan_close_after_min,
        "allow_duplicate": bool(event.allow_duplicate),
        "color": event.color,
        **svc.counts(db, event),
    }
    if event.audience == "subset":
        data["participant_ids"] = [link.participant_id for link in event.event_participants]
    else:
        data["participant_ids"] = []
    return data


def _apply(event: Event, body: EventIn) -> None:
    if body.end_time <= body.start_time:
        raise BadRequestException("Jam selesai harus setelah jam mulai")
    if body.status not in {"draft", "active", "done", "archived"}:
        raise BadRequestException("Status kegiatan tidak dikenal")
    if body.audience not in {"all", "subset"}:
        raise BadRequestException("Peserta wajib harus semua atau subset")
    event.name = body.name.strip()
    event.event_date = body.event_date
    event.start_time = body.start_time
    event.end_time = body.end_time
    event.location = body.location.strip() if body.location else None
    event.status = body.status
    event.audience = body.audience
    event.scan_open_before_min = body.scan_open_before_min
    event.scan_close_after_min = body.scan_close_after_min
    event.allow_duplicate = body.allow_duplicate
    event.color = body.color or "#4F46E5"


@router.get("/", response_model=WebResponse[dict])
def list_events(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission(["view_event", "scan_attendance"])),
):
    query = db.query(Event).order_by(Event.event_date.desc(), Event.start_time)
    if status:
        query = query.filter(Event.status == status)
    events = query.all()
    return WebResponse(data={"events": [_read(db, event) for event in events]})


@router.get("/current", response_model=WebResponse[dict])
def current_event(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("scan_attendance")),
):
    event = svc.suggest_event(db)
    return WebResponse(data={"event": _read(db, event) if event else None})


@router.get("/{event_id}", response_model=WebResponse[dict])
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission(["view_event", "scan_attendance"])),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise NotFoundException("Kegiatan tidak ditemukan")
    return WebResponse(data=_read(db, event))


@router.post("/", response_model=WebResponse[dict])
def create_event(
    body: EventIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create_event")),
):
    event = Event()
    _apply(event, body)
    db.add(event)
    db.flush()
    svc.replace_event_participants(db, event, svc.resolve_participant_ids(db, body.participant_ids))
    write_audit(db, user_id=user.id, action="create", entity="event", entity_id=event.id, detail={"name": event.name})
    db.commit()
    db.refresh(event)
    return WebResponse(message="Kegiatan dibuat", data=_read(db, event))


@router.put("/{event_id}", response_model=WebResponse[dict])
def update_event(
    event_id: str,
    body: EventIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("update_event")),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise NotFoundException("Kegiatan tidak ditemukan")
    _apply(event, body)
    svc.replace_event_participants(db, event, svc.resolve_participant_ids(db, body.participant_ids))
    write_audit(db, user_id=user.id, action="update", entity="event", entity_id=event.id, detail={"name": event.name})
    db.commit()
    db.refresh(event)
    return WebResponse(message="Kegiatan diperbarui", data=_read(db, event))


@router.post("/{event_id}/archive", response_model=WebResponse[dict])
def archive_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("archive_event")),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise NotFoundException("Kegiatan tidak ditemukan")
    event.status = "archived"
    write_audit(db, user_id=user.id, action="archive", entity="event", entity_id=event.id, detail=None)
    db.commit()
    return WebResponse(message="Kegiatan diarsipkan", data=_read(db, event))


@router.post("/{event_id}/duplicate", response_model=WebResponse[dict])
def duplicate_event(
    event_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create_event")),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise NotFoundException("Kegiatan tidak ditemukan")
    copy = svc.duplicate_event(db, event, user.id)
    return WebResponse(message="Kegiatan diduplikasi", data=_read(db, copy))


@router.delete("/{event_id}", response_model=WebResponse[dict])
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("archive_event")),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise NotFoundException("Kegiatan tidak ditemukan")
    if db.query(Attendance.id).filter(Attendance.event_id == event.id).first():
        raise ConflictException("Kegiatan yang sudah punya presensi hanya bisa diarsipkan")
    db.query(EventParticipant).filter(EventParticipant.event_id == event.id).delete()
    db.delete(event)
    db.commit()
    return WebResponse(message="Kegiatan dihapus", data={"id": event_id})
