from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session
from typing import List
from jose import jwt, JWTError
from app.config import settings
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.assignment import Assignment
from app.models.proctoring import ProctoringEvent, ProctoringScreenshot
from app.schemas.proctoring import ProctoringEventCreate, ProctoringEventOut, ViolationResult, ScreenshotUpload, ScreenshotOut
from app.services.proctoring_manager import proctoring_manager
from app.core.security import require_admin, require_student, ensure_can_access_assignment
from app.services.attempts import get_attempt, broadcast_attempt

router = APIRouter(tags=["Proctoring & Anti-Cheat"])

@router.post("/proctoring/events", response_model=ViolationResult)
async def record_proctoring_event(
    event_in: ProctoringEventCreate,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Log an anti-cheat event. Strikes are counted here; reaching the limit locks the attempt."""
    ensure_can_access_assignment(db, event_in.assignment_id, current_user)
    attempt = get_attempt(db, event_in.assignment_id, current_user.id)
    if not attempt:
        raise HTTPException(status_code=409, detail="Start the test before reporting events.")

    counted = event_in.counts_as_strike and attempt.status == "in_progress"
    if counted:
        attempt.strikes += 1
        if attempt.strikes >= attempt.allowed_strikes:
            attempt.status = "locked"

    event = ProctoringEvent(
        assignment_id=event_in.assignment_id,
        student_id=current_user.id,
        event_type=event_in.event_type,
        severity="high" if attempt.status == "locked" else event_in.severity,
        strike_count=attempt.strikes,
        details=event_in.details
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    db.refresh(attempt)
    await broadcast_attempt(attempt)
    if counted:
        await proctoring_manager.broadcast_admin_feed({
            "type": "violation",
            "event_id": event.id,
            "assignment_id": attempt.assignment_id,
            "assignment_title": attempt.assignment.title,
            "student_id": current_user.id,
            "student_name": current_user.name,
            "student_email": current_user.email,
            "event_type": event.event_type,
            "details": event.details,
            "strikes": attempt.strikes,
            "allowed_strikes": attempt.allowed_strikes,
            "status": attempt.status,
            "timestamp": event.timestamp.isoformat()
        })
    return {"event": event, "attempt": attempt}

MAX_SCREENSHOT_CHARS = 2_000_000  # ~1.5 MB JPEG as base64

@router.post("/proctoring/events/{event_id}/screenshot", response_model=ScreenshotOut)
async def upload_violation_screenshot(
    event_id: int,
    shot_in: ScreenshotUpload,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Attach a frame of the student's shared screen to one of their own strike events."""
    event = db.query(ProctoringEvent).filter(
        ProctoringEvent.id == event_id,
        ProctoringEvent.student_id == current_user.id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.screenshot:
        raise HTTPException(status_code=409, detail="Screenshot already uploaded for this event")
    if not shot_in.image.startswith("data:image/jpeg;base64,") or len(shot_in.image) > MAX_SCREENSHOT_CHARS:
        raise HTTPException(status_code=400, detail="Screenshot must be a JPEG data URL under 1.5 MB")

    db.add(ProctoringScreenshot(event_id=event.id, image=shot_in.image))
    db.commit()
    await proctoring_manager.broadcast_admin_feed({
        "type": "violation_screenshot",
        "event_id": event.id,
        "image": shot_in.image
    })
    return {"event_id": event.id, "image": shot_in.image}

@router.get("/proctoring/events/{event_id}/screenshot", response_model=ScreenshotOut)
def get_violation_screenshot(
    event_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    shot = db.query(ProctoringScreenshot).filter(ProctoringScreenshot.event_id == event_id).first()
    if not shot:
        raise HTTPException(status_code=404, detail="No screenshot for this event")
    return {"event_id": event_id, "image": shot.image}

@router.get("/assignments/{assignment_id}/proctoring-events", response_model=List[ProctoringEventOut])
def get_assignment_proctoring_events(
    assignment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Test not found")

    events = db.query(ProctoringEvent).filter(
        ProctoringEvent.assignment_id == assignment_id
    ).order_by(ProctoringEvent.timestamp.desc()).all()
    return events

@router.get("/assignments/{assignment_id}/active-proctoring")
def get_active_proctoring_state(
    assignment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Test not found")

    return proctoring_manager.get_room_summary(assignment_id)

# WebSocket endpoint for real-time WebRTC signaling and anti-cheat event streaming
@router.websocket("/ws/proctoring/{assignment_id}")
async def proctoring_websocket(
    websocket: WebSocket,
    assignment_id: int,
    token: str = Query(...)
):
    # Verify JWT from query param
    db = SessionLocal()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str = payload.get("sub")
        if not user_id_str:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = int(user_id_str)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        try:
            ensure_can_access_assignment(db, assignment_id, user)
        except HTTPException:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except (JWTError, ValueError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    finally:
        db.close()

    # Connect to room
    await proctoring_manager.connect(
        websocket=websocket,
        assignment_id=assignment_id,
        user_id=user.id,
        role=user.role,
        user_name=user.name,
        user_email=user.email
    )

    try:
        while True:
            data = await websocket.receive_json()
            await proctoring_manager.handle_message(
                assignment_id=assignment_id,
                user_id=user.id,
                role=user.role,
                data=data
            )
    except WebSocketDisconnect:
        await proctoring_manager.disconnect(
            assignment_id=assignment_id,
            user_id=user.id,
            role=user.role
        )
    except Exception:
        await proctoring_manager.disconnect(
            assignment_id=assignment_id,
            user_id=user.id,
            role=user.role
        )

# Admin-wide alert feed: strike pop-ups (with screenshots) on every admin page
@router.websocket("/ws/admin/alerts")
async def admin_alerts_websocket(websocket: WebSocket, token: str = Query(...)):
    db = SessionLocal()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user = db.query(User).filter(User.id == int(payload.get("sub") or 0)).first()
    except (JWTError, ValueError):
        user = None
    finally:
        db.close()
    if not user or user.role != "admin":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await proctoring_manager.connect_admin_feed(websocket, user.id)
    try:
        while True:
            await websocket.receive_text()  # Keep-alive; admins don't send anything
    except Exception:
        proctoring_manager.disconnect_admin_feed(websocket, user.id)
