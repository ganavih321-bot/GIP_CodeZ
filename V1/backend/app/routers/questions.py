from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.assignment import Assignment
from app.models.question import Question, TestCase
from app.schemas.question import QuestionCreate, QuestionOut
from app.core.security import require_admin

router = APIRouter(tags=["Questions & Test Cases"])

@router.post("/assignments/{assignment_id}/questions", response_model=QuestionOut)
def create_question(
    assignment_id: int,
    q_in: QuestionCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Test not found")

    question = Question(
        assignment_id=assignment_id,
        title=q_in.title,
        problem_statement=q_in.problem_statement,
        difficulty=q_in.difficulty,
        starter_code=q_in.starter_code,
        constraints=q_in.constraints,
        points=q_in.points
    )
    db.add(question)
    db.flush()

    for idx, tc in enumerate(q_in.test_cases):
        test_case = TestCase(
            question_id=question.id,
            input_data=tc.input_data,
            expected_output=tc.expected_output,
            is_hidden=tc.is_hidden,
            explanation=tc.explanation,
            order_index=tc.order_index or idx
        )
        db.add(test_case)

    db.commit()
    db.refresh(question)
    return question

@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(question)
    db.commit()
    return {"message": "Question deleted successfully"}
