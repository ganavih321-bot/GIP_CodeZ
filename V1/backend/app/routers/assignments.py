from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.assignment import Assignment, AssignmentAssignee
from app.schemas.assignment import AssignmentCreate, AssignmentOut, AssigneesUpdate, StudentAssignmentView
from app.schemas.question import StudentQuestionView, StudentTestCaseView
from app.core.security import get_current_user, require_admin, ensure_can_access_assignment

router = APIRouter(tags=["Tests & Assignments"])

def get_assignment_or_404(db: Session, assignment_id: int) -> Assignment:
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Test not found")
    return assignment

def set_assignees(db: Session, assignment: Assignment, student_ids: List[int]) -> None:
    wanted = set(student_ids)
    if wanted:
        found = {
            u.id for u in db.query(User).filter(User.id.in_(wanted), User.role == "student").all()
        }
        missing = wanted - found
        if missing:
            raise HTTPException(status_code=404, detail=f"Students not found: {sorted(missing)}")

    current = {a.student_id: a for a in assignment.assignees}
    for sid, link in current.items():
        if sid not in wanted:
            db.delete(link)
    for sid in wanted - current.keys():
        db.add(AssignmentAssignee(assignment_id=assignment.id, student_id=sid))

def to_student_view(assignment: Assignment) -> StudentAssignmentView:
    # Mask the hidden test cases
    student_questions = []
    for q in assignment.questions:
        sample_cases = [
            StudentTestCaseView(
                id=tc.id,
                order_index=tc.order_index,
                is_hidden=False,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                explanation=tc.explanation
            )
            for tc in q.test_cases if not tc.is_hidden
        ]
        student_questions.append(StudentQuestionView(
            id=q.id,
            assignment_id=q.assignment_id,
            title=q.title,
            problem_statement=q.problem_statement,
            difficulty=q.difficulty,
            starter_code=q.starter_code,
            constraints=q.constraints,
            points=q.points,
            sample_test_cases=sample_cases,
            total_test_cases_count=len(q.test_cases)
        ))

    return StudentAssignmentView(
        id=assignment.id,
        title=assignment.title,
        description=assignment.description,
        type=assignment.type,
        is_proctored=assignment.is_proctored,
        time_limit_minutes=assignment.time_limit_minutes,
        max_strikes=assignment.max_strikes,
        created_at=assignment.created_at,
        questions=student_questions
    )

@router.post("/assignments", response_model=AssignmentOut)
def create_assignment(
    assign_in: AssignmentCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = Assignment(
        created_by_id=current_user.id,
        title=assign_in.title,
        description=assign_in.description,
        type=assign_in.type,
        is_proctored=assign_in.is_proctored,
        time_limit_minutes=assign_in.time_limit_minutes,
        max_strikes=assign_in.max_strikes
    )
    db.add(assignment)
    db.flush()
    set_assignees(db, assignment, assign_in.student_ids)
    db.commit()
    db.refresh(assignment)
    return assignment

@router.get("/assignments")
def list_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admins see every test; students see only the tests assigned to them."""
    if current_user.role == "admin":
        assignments = db.query(Assignment).order_by(Assignment.created_at.desc()).all()
        return [AssignmentOut.model_validate(a) for a in assignments]

    links = db.query(AssignmentAssignee).filter(AssignmentAssignee.student_id == current_user.id).all()
    return [to_student_view(link.assignment) for link in links]

@router.get("/assignments/{assignment_id}")
def get_assignment_detail(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = get_assignment_or_404(db, assignment_id)
    ensure_can_access_assignment(db, assignment_id, current_user)

    if current_user.role == "admin":
        return AssignmentOut.model_validate(assignment)
    return to_student_view(assignment)

@router.put("/assignments/{assignment_id}/assignees", response_model=AssignmentOut)
def update_assignees(
    assignment_id: int,
    update_in: AssigneesUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = get_assignment_or_404(db, assignment_id)
    set_assignees(db, assignment, update_in.student_ids)
    db.commit()
    db.refresh(assignment)
    return assignment

@router.delete("/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = get_assignment_or_404(db, assignment_id)
    db.delete(assignment)
    db.commit()
    return {"message": "Test deleted successfully"}
