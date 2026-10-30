from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.assignment import Assignment
from app.models.attempt import ExamAttempt
from app.schemas.proctoring import AttemptOut, StrikeReset
from app.services.attempts import get_attempt, close_if_expired, broadcast_attempt
from app.core.security import require_admin, require_student, ensure_can_access_assignment

router = APIRouter(tags=["Exam Attempts & Strikes"])

@router.get("/assignments/{assignment_id}/attempt", response_model=Optional[AttemptOut])
def get_my_attempt(
    assignment_id: int,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """The student's attempt for this test, or null if not started yet."""
    attempt = get_attempt(db, assignment_id, current_user.id)
    if attempt:
        close_if_expired(db, attempt)
    return attempt

@router.post("/assignments/{assignment_id}/attempt/start", response_model=AttemptOut)
def start_attempt(
    assignment_id: int,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Begin the test (starts the timer), or resume the existing attempt."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Test not found")
    ensure_can_access_assignment(db, assignment_id, current_user)

    attempt = get_attempt(db, assignment_id, current_user.id)
    if attempt is None:
        attempt = ExamAttempt(
            assignment_id=assignment_id,
            student_id=current_user.id,
            allowed_strikes=assignment.max_strikes
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
    else:
        close_if_expired(db, attempt)
    return attempt

@router.post("/assignments/{assignment_id}/attempt/finish", response_model=AttemptOut)
async def finish_attempt(
    assignment_id: int,
    current_user: User = Depends(require_student),
    db: Session = Depends(get_db)
):
    attempt = get_attempt(db, assignment_id, current_user.id)
    if not attempt:
        raise HTTPException(status_code=404, detail="You haven't started this test.")
    if attempt.status != "submitted":
        attempt.status = "submitted"
        attempt.ended_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(attempt)
        await broadcast_attempt(attempt)
    return attempt

@router.get("/assignments/{assignment_id}/attempts", response_model=List[AttemptOut])
def list_attempts(
    assignment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    attempts = db.query(ExamAttempt).filter(
        ExamAttempt.assignment_id == assignment_id
    ).order_by(ExamAttempt.started_at.desc()).all()
    for a in attempts:
        close_if_expired(db, a)
    return attempts

@router.post("/assignments/{assignment_id}/attempts/{student_id}/reset", response_model=AttemptOut)
async def reset_strikes(
    assignment_id: int,
    student_id: int,
    reset_in: StrikeReset,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Clear a student's strikes, set how many they get from now on, and unlock the test."""
    attempt = get_attempt(db, assignment_id, student_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="This student hasn't started the test.")
    close_if_expired(db, attempt)
    if attempt.status == "submitted":
        raise HTTPException(status_code=409, detail="This attempt is already submitted (or its time ran out).")

    attempt.strikes = 0
    attempt.allowed_strikes = reset_in.allowed_strikes
    attempt.status = "in_progress"
    db.commit()
    db.refresh(attempt)
    await broadcast_attempt(attempt)
    return attempt
