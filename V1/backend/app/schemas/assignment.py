from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.question import QuestionOut, StudentQuestionView

class AssignmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    type: str = "exam"  # "exam" | "homework"
    is_proctored: bool = True
    time_limit_minutes: Optional[int] = 60
    max_strikes: int = 3

class AssignmentCreate(AssignmentBase):
    pass

class AssignmentOut(AssignmentBase):
    id: int
    classroom_id: int
    created_at: datetime
    questions: List[QuestionOut] = []
    model_config = ConfigDict(from_attributes=True)

class StudentAssignmentView(AssignmentBase):
    id: int
    classroom_id: int
    created_at: datetime
    questions: List[StudentQuestionView] = []
