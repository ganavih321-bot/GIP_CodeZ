from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from email_validator import validate_email, EmailNotValidError
from app.database import get_db
from app.models.user import User
from app.models.assignment import Assignment, AssignmentAssignee
from app.schemas.user import StudentOut, BulkInviteRequest, BulkInviteResult
from app.core.security import require_admin

router = APIRouter(prefix="/admin/students", tags=["Admin: Students"])

MAX_INVITES_PER_REQUEST = 1000

@router.get("", response_model=List[StudentOut])
def list_students(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    students = db.query(User).filter(User.role == "student").order_by(User.created_at.desc()).all()
    res = []
    for s in students:
        out = StudentOut.model_validate(s)
        out.assigned_tests_count = len(s.assigned_tests)
        res.append(out)
    return res

@router.post("/invite", response_model=BulkInviteResult)
def invite_students(
    invite_in: BulkInviteRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if len(invite_in.students) > MAX_INVITES_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"At most {MAX_INVITES_PER_REQUEST} students per invite.")

    assignments = []
    if invite_in.assignment_ids:
        assignments = db.query(Assignment).filter(Assignment.id.in_(invite_in.assignment_ids)).all()
        if len(assignments) != len(set(invite_in.assignment_ids)):
            raise HTTPException(status_code=404, detail="One or more selected tests were not found.")

    invited, already_exists, invalid = [], [], []
    seen = set()
    for entry in invite_in.students:
        raw = entry.email.strip()
        try:
            email = validate_email(raw, check_deliverability=False).normalized.lower()
        except EmailNotValidError:
            invalid.append(raw)
            continue
        if email in seen:
            continue
        seen.add(email)

        if db.query(User).filter(User.email == email).first():
            already_exists.append(email)
            continue

        student = User(
            name=(entry.name or "").strip() or email.split("@")[0],
            email=email,
            role="student",
            status="invited",
            invited_by_id=current_user.id
        )
        db.add(student)
        db.flush()
        for a in assignments:
            db.add(AssignmentAssignee(assignment_id=a.id, student_id=student.id))
        invited.append(student)

    db.commit()
    for s in invited:
        db.refresh(s)
    return {"invited": invited, "already_exists": already_exists, "invalid": invalid}

@router.delete("/{student_id}")
def remove_student(
    student_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    db.delete(student)
    db.commit()
    return {"message": "Student removed and access revoked"}
