from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Union
from app.database import get_db
from app.models.user import User
from app.models.classroom import Classroom
from app.models.assignment import Assignment
from app.schemas.assignment import AssignmentCreate, AssignmentOut, StudentAssignmentView
from app.schemas.question import StudentQuestionView, StudentTestCaseView
from app.core.security import get_current_user, require_teacher

router = APIRouter(tags=["Assignments & Exams"])

@router.post("/classrooms/{classroom_id}/assignments", response_model=AssignmentOut)
def create_assignment(
    classroom_id: int,
    assign_in: AssignmentCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found or unauthorized")

    assignment = Assignment(
        classroom_id=classroom_id,
        title=assign_in.title,
        description=assign_in.description,
        type=assign_in.type,
        is_proctored=assign_in.is_proctored,
        time_limit_minutes=assign_in.time_limit_minutes,
        max_strikes=assign_in.max_strikes
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment

@router.get("/classrooms/{classroom_id}/assignments", response_model=List[AssignmentOut])
def list_assignments(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignments = db.query(Assignment).filter(Assignment.classroom_id == classroom_id).all()
    return assignments

@router.get("/assignments/{assignment_id}")
def get_assignment_detail(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # If teacher of this classroom, return full details with all test cases
    if assignment.classroom.teacher_id == current_user.id:
        return AssignmentOut.model_validate(assignment)

    # If student, mask the hidden test cases
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
        student_q = StudentQuestionView(
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
        )
        student_questions.append(student_q)

    return StudentAssignmentView(
        id=assignment.id,
        classroom_id=assignment.classroom_id,
        title=assignment.title,
        description=assignment.description,
        type=assignment.type,
        is_proctored=assignment.is_proctored,
        time_limit_minutes=assignment.time_limit_minutes,
        max_strikes=assignment.max_strikes,
        created_at=assignment.created_at,
        questions=student_questions
    )
