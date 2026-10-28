from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class TestCaseBase(BaseModel):
    input_data: str = ""
    expected_output: str = ""
    is_hidden: bool = False
    explanation: Optional[str] = None
    order_index: int = 0

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseOut(TestCaseBase):
    id: int
    question_id: int
    model_config = ConfigDict(from_attributes=True)

class QuestionBase(BaseModel):
    title: str
    problem_statement: str
    difficulty: str = "Medium"
    starter_code: str = "# Write your solution here\nimport sys\n\ndef main():\n    pass\n\nif __name__ == '__main__':\n    main()\n"
    constraints: Optional[str] = None
    points: int = 100

class QuestionCreate(QuestionBase):
    test_cases: List[TestCaseCreate] = []

class QuestionOut(QuestionBase):
    id: int
    assignment_id: int
    created_at: datetime
    test_cases: List[TestCaseOut] = []
    model_config = ConfigDict(from_attributes=True)

# Masked view for students during an active exam (hidden test cases don't leak input/output)
class StudentTestCaseView(BaseModel):
    id: int
    order_index: int
    is_hidden: bool
    input_data: Optional[str] = None
    expected_output: Optional[str] = None
    explanation: Optional[str] = None

class StudentQuestionView(QuestionBase):
    id: int
    assignment_id: int
    sample_test_cases: List[StudentTestCaseView] = []
    total_test_cases_count: int = 0
