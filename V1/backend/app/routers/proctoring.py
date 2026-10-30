from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session
from typing import List
from jose import jwt, JWTError
from app.config import settings
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.assignment import Assignment
from app.models.proctoring import ProctoringEvent
from app.schemas.proctoring import ProctoringEventCreate, ProctoringEventOut, ViolationResult
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

    if event_in.counts_as_strike and attempt.status == "in_progress":
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
    return {"event": event, "attempt": attempt}

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
