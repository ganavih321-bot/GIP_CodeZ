from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.user import UserOut
from app.schemas.assignment import AssignmentOut

class ClassroomBase(BaseModel):
    title: str
    description: Optional[str] = None

class ClassroomCreate(ClassroomBase):
    pass

class ClassroomJoin(BaseModel):
    code: str

class ClassroomOut(ClassroomBase):
    id: int
    code: str
    teacher_id: int
    created_at: datetime
    teacher: Optional[UserOut] = None
    assignments: List[AssignmentOut] = []
    enrolled_students_count: int = 0
    model_config = ConfigDict(from_attributes=True)

class ClassroomDetailOut(ClassroomOut):
    enrolled_students: List[UserOut] = []
