"""Peserta Rakernas."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permission
from app.core.exceptions import ConflictException, NotFoundException
from app.models.attendance import Attendance, Participant
from app.models.auth import User
from app.schemas.common import WebResponse
from app.services import attendance_service as svc
from app.services.attendance_service import write_audit

router = APIRouter()


class ParticipantIn(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    organization: str = Field(min_length=1, max_length=255)
    status: str = "active"


class ImportCommit(BaseModel):
    rows: list[dict]


def _read(participant: Participant) -> dict:
    return {
        "id": participant.id,
        "code": participant.code,
        "name": participant.name,
        "organization": participant.organization,
        "status": participant.status,
        "printed_at": participant.printed_at.isoformat() if participant.printed_at else None,
        "created_at": participant.created_at.isoformat() if participant.created_at else None,
    }


@router.get("/", response_model=WebResponse[dict])
def list_participants(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: Optional[str] = None,
    organization: Optional[str] = None,
    status: Optional[str] = None,
    all_records: bool = Query(False, alias="all"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_participant")),
):
    query = db.query(Participant)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(Participant.name.ilike(like), Participant.organization.ilike(like), Participant.code.ilike(like))
        )
    if organization:
        query = query.filter(Participant.organization == organization)
    if status:
        query = query.filter(Participant.status == status)
    query = query.order_by(Participant.code)
    if all_records:
        rows = query.limit(2000).all()
        return WebResponse(data={"participants": [_read(p) for p in rows]})
    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()
    return WebResponse(
        data={
            "participants": [_read(p) for p in rows],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": (total + limit - 1) // limit if limit else 0,
            },
        }
    )


@router.get("/organizations", response_model=WebResponse[dict])
def list_organizations(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_participant")),
):
    rows = (
        db.query(Participant.organization)
        .distinct()
        .order_by(Participant.organization)
        .all()
    )
    return WebResponse(data={"organizations": [row[0] for row in rows]})


@router.get("/{participant_id}", response_model=WebResponse[dict])
def get_participant(
    participant_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_participant")),
):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise NotFoundException("Peserta tidak ditemukan")
    history = (
        db.query(Attendance)
        .filter(Attendance.participant_id == participant.id)
        .order_by(Attendance.scanned_at.desc())
        .all()
    )
    data = _read(participant)
    data["history"] = [
        {
            "event_id": row.event_id,
            "event_name": row.event.name if row.event else "",
            "scanned_at": row.scanned_at.isoformat(),
            "method": row.method,
        }
        for row in history
    ]
    return WebResponse(data=data)


@router.post("/", response_model=WebResponse[dict])
def create_participant(
    body: ParticipantIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("create_participant")),
):
    code = body.code.strip()
    if db.query(Participant).filter(Participant.code == code).first():
        raise ConflictException("Kode sudah dipakai")
    participant = Participant(
        code=code,
        name=body.name.strip(),
        organization=body.organization.strip(),
        status=svc.normalize_status(body.status),
    )
    db.add(participant)
    db.flush()
    write_audit(db, user_id=user.id, action="create", entity="participant", entity_id=participant.id, detail={"code": code})
    db.commit()
    db.refresh(participant)
    return WebResponse(message="Peserta ditambahkan", data=_read(participant))


@router.put("/{participant_id}", response_model=WebResponse[dict])
def update_participant(
    participant_id: str,
    body: ParticipantIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("update_participant")),
):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise NotFoundException("Peserta tidak ditemukan")
    code = body.code.strip()
    taken = db.query(Participant).filter(Participant.code == code, Participant.id != participant.id).first()
    if taken:
        raise ConflictException("Kode sudah dipakai")
    participant.code = code
    participant.name = body.name.strip()
    participant.organization = body.organization.strip()
    participant.status = svc.normalize_status(body.status)
    write_audit(db, user_id=user.id, action="update", entity="participant", entity_id=participant.id, detail={"code": code})
    db.commit()
    db.refresh(participant)
    return WebResponse(message="Peserta diperbarui", data=_read(participant))


@router.delete("/{participant_id}", response_model=WebResponse[dict])
def delete_participant(
    participant_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("delete_participant")),
):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise NotFoundException("Peserta tidak ditemukan")
    if db.query(Attendance.id).filter(Attendance.participant_id == participant.id).first():
        raise ConflictException("Peserta sudah punya riwayat presensi")
    write_audit(db, user_id=user.id, action="delete", entity="participant", entity_id=participant.id, detail={"code": participant.code})
    db.delete(participant)
    db.commit()
    return WebResponse(message="Peserta dihapus", data={"id": participant_id})


@router.post("/import/preview", response_model=WebResponse[dict])
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("import_participant")),
):
    content = await file.read()
    rows = svc.parse_participant_file(file.filename or "peserta.xlsx", content)
    return WebResponse(data=svc.preview_import(db, rows))


@router.post("/import/commit", response_model=WebResponse[dict])
def commit_import(
    body: ImportCommit,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("import_participant")),
):
    result = svc.commit_import(db, body.rows, user.id)
    return WebResponse(message="Import selesai", data=result)
