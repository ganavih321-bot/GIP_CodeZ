from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.question import QuestionOut, StudentQuestionView
from app.schemas.user import UserOut

class AssignmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    type: str = "exam"  # "exam" | "homework"
    is_proctored: bool = True
    time_limit_minutes: Optional[int] = 60
    max_strikes: int = 3

class AssignmentCreate(AssignmentBase):
    student_ids: List[int] = []

class AssigneesUpdate(BaseModel):
    student_ids: List[int]

class AssignmentOut(AssignmentBase):
    id: int
    created_at: datetime
    questions: List[QuestionOut] = []
    assigned_students: List[UserOut] = []
    model_config = ConfigDict(from_attributes=True)

class StudentAssignmentView(AssignmentBase):
    id: int
    created_at: datetime
    questions: List[StudentQuestionView] = []
