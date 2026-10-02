"""Scan presensi dan dashboard live."""
import asyncio
import json

from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permission, user_has_permission
from app.core.deps_permission import _load_user_permissions
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.auth import User
from app.schemas.common import WebResponse
from app.services import attendance_service as svc
from app.services.attendance_service import LIVE_CHANNEL

router = APIRouter()
ws_router = APIRouter()


class ScanIn(BaseModel):
    event_id: str
    code: str = Field(min_length=1, max_length=64)
    method: str = "scanner"
    force: bool = False


class UndoIn(BaseModel):
    event_id: str


@router.post("/scan", response_model=WebResponse[dict])
def scan(
    body: ScanIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("scan_attendance")),
):
    if body.method not in {"scanner", "camera", "manual"}:
        body.method = "scanner"
    if body.force and not user_has_permission(db, user, ["update_event", "create_event"]):
        body.force = False
    device = request.headers.get("user-agent")
    result = svc.scan_code(
        db,
        event_id=body.event_id,
        code=body.code,
        method=body.method,
        user=user,
        device=device,
        force=body.force,
    )
    return WebResponse(data=result)


@router.post("/undo", response_model=WebResponse[dict])
def undo(
    body: UndoIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("scan_attendance")),
):
    return WebResponse(data=svc.undo_last_scan(db, event_id=body.event_id, user=user))


@router.get("/recent", response_model=WebResponse[dict])
def recent(
    event_id: str = Query(...),
    mine: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("scan_attendance")),
):
    only_mine = mine or not user_has_permission(db, user, "view_dashboard")
    rows = svc.recent_scans(db, event_id, user_id=user.id if only_mine else None)
    return WebResponse(data={"scans": rows})


@router.get("/dashboard", response_model=WebResponse[dict])
def dashboard(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_dashboard")),
):
    return WebResponse(data=svc.dashboard_snapshot(db))


def _ws_can_view(websocket: WebSocket) -> bool:
    token = websocket.cookies.get("access_token")
    if not token:
        return False
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return False
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == payload["sub"]).first()
        if not user:
            return False
        _load_user_permissions(db, user)
        if any(role.name == "superadmin" for role in user.roles or []):
            return True
        names = {perm.name for role in user.roles or [] for perm in (role.permissions or [])}
        return "view_dashboard" in names
    finally:
        db.close()


@ws_router.websocket("/dashboard")
async def live_socket(websocket: WebSocket):
    if not _ws_can_view(websocket):
        await websocket.close(code=4401)
        return

    await websocket.accept()
    client = None
    pubsub = None
    try:
        from app.core.redis_client import get_redis_client

        client = get_redis_client()
        if client is not None:
            pubsub = client.pubsub()
            pubsub.subscribe(LIVE_CHANNEL)
        while True:
            if pubsub is None:
                await asyncio.sleep(2)
                continue
            message = await asyncio.to_thread(pubsub.get_message, timeout=1.0)
            if message and message.get("type") == "message":
                data = message.get("data")
                if isinstance(data, bytes):
                    data = data.decode()
                await websocket.send_text(data if isinstance(data, str) else json.dumps(data))
    except WebSocketDisconnect:
        return
    finally:
        if pubsub is not None:
            try:
                pubsub.close()
            except Exception:
                pass
