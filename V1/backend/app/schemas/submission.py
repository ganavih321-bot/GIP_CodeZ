from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.user import UserOut

class TestResultDetail(BaseModel):
    id: int
    test_case_id: int
    status: str
    actual_output: str
    execution_time_ms: float
    error_message: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class SubmissionOut(BaseModel):
    id: int
    assignment_id: int
    question_id: int
    student_id: int
    code: str
    status: str
    score: float
    passed_cases: int
    total_cases: int
    submitted_at: datetime
    student: Optional[UserOut] = None
    test_results: List[TestResultDetail] = []
    model_config = ConfigDict(from_attributes=True)
