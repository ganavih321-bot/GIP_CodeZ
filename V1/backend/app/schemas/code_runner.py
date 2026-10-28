from pydantic import BaseModel
from typing import Optional, List

class RunCodeRequest(BaseModel):
    question_id: int
    code: str
    custom_input: Optional[str] = None

class SingleTestRunResult(BaseModel):
    test_case_id: Optional[int] = None
    is_hidden: bool = False
    input_data: Optional[str] = None
    expected_output: Optional[str] = None
    actual_output: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    execution_time_ms: float = 0.0
    status: str  # "Passed", "Wrong Answer", "Time Limit Exceeded", "Runtime Error"
    diff: Optional[str] = None

class RunCodeResponse(BaseModel):
    status: str  # "Success", "Failed", "Compilation Error"
    total_tests: int
    passed_tests: int
    results: List[SingleTestRunResult]

class SubmitCodeRequest(BaseModel):
    assignment_id: int
    question_id: int
    code: str

class SubmitCodeResponse(BaseModel):
    submission_id: int
    status: str  # "Accepted", "Wrong Answer", "Runtime Error", "Time Limit Exceeded"
    score: float
    passed_cases: int
    total_cases: int
    results: List[SingleTestRunResult]
