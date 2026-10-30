from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.schemas.submission import SubmissionOut
from app.core.security import get_current_user, require_admin

router = APIRouter(tags=["Submissions"])

@router.get("/assignments/{assignment_id}/submissions", response_model=List[SubmissionOut])
def get_assignment_submissions(
    assignment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Test not found")

    submissions = db.query(Submission).filter(
        Submission.assignment_id == assignment_id
    ).order_by(Submission.submitted_at.desc()).all()
    return submissions

@router.get("/assignments/{assignment_id}/my-submissions", response_model=List[SubmissionOut])
def get_my_submissions(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submissions = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id == current_user.id
    ).order_by(Submission.submitted_at.desc()).all()
    return submissions

@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
def get_submission_detail(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    is_admin = (current_user.role == "admin")
    is_owner = (submission.student_id == current_user.id)
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Unauthorized to view this submission")

    return submission
