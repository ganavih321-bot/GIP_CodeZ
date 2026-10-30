from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.attempt import ExamAttempt
from app.services.proctoring_manager import proctoring_manager
from app.schemas.proctoring import AttemptOut

def get_attempt(db: Session, assignment_id: int, student_id: int) -> Optional[ExamAttempt]:
    return db.query(ExamAttempt).filter(
        ExamAttempt.assignment_id == assignment_id,
        ExamAttempt.student_id == student_id
    ).first()

def close_if_expired(db: Session, attempt: ExamAttempt) -> None:
    """Auto-submit an attempt whose time limit has run out."""
    if attempt.status != "submitted" and attempt.assignment.time_limit_minutes and attempt.seconds_remaining == 0:
        attempt.status = "submitted"
        attempt.ended_at = datetime.now(timezone.utc)
        db.commit()

def require_active_attempt(db: Session, assignment_id: int, user: User) -> Optional[ExamAttempt]:
    """Students can only run/submit code while their attempt is in progress. Admins are unrestricted."""
    if user.role == "admin":
        return None
    attempt = get_attempt(db, assignment_id, user.id)
    if attempt:
        close_if_expired(db, attempt)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Start the test before running code.")
    if attempt.status == "locked":
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Your test is locked: maximum strikes reached. Ask your admin to reset your strikes.")
    if attempt.status == "submitted":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This test has already been submitted.")
    return attempt

async def broadcast_attempt(attempt: ExamAttempt) -> None:
    """Push the attempt's latest state to the student and to admins watching the live monitor."""
    data = AttemptOut.model_validate(attempt).model_dump(mode="json")
    proctoring_manager.update_strikes(attempt.assignment_id, attempt.student_id, attempt.strikes)
    await proctoring_manager.broadcast_to_teachers(attempt.assignment_id, {"type": "attempt_update", "attempt": data})
    await proctoring_manager.send_to_student(attempt.assignment_id, attempt.student_id, {"type": "attempt_update", "attempt": data})
