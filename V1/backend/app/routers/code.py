from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.question import Question, TestCase
from app.models.assignment import Assignment
from app.models.submission import Submission, TestResult
from app.schemas.code_runner import (
    RunCodeRequest,
    RunCodeResponse,
    SingleTestRunResult,
    SubmitCodeRequest,
    SubmitCodeResponse
)
from app.services.code_runner import execution_engine
from app.core.security import get_current_user, ensure_can_access_assignment
from app.services.attempts import require_active_attempt

router = APIRouter(prefix="/code", tags=["Code Execution"])

@router.post("/run", response_model=RunCodeResponse)
def run_code(
    run_req: RunCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    question = db.query(Question).filter(Question.id == run_req.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    ensure_can_access_assignment(db, question.assignment_id, current_user)
    require_active_attempt(db, question.assignment_id, current_user)

    results = []
    # If custom input is specified by the student
    if run_req.custom_input is not None:
        exec_res = execution_engine.run_single_test(
            code=run_req.code,
            input_data=run_req.custom_input,
            expected_output=None
        )
        results.append(SingleTestRunResult(
            test_case_id=None,
            is_hidden=False,
            input_data=run_req.custom_input,
            expected_output=None,
            actual_output=exec_res["actual_output"],
            stdout=exec_res["stdout"],
            stderr=exec_res["stderr"],
            execution_time_ms=exec_res["execution_time_ms"],
            status=exec_res["status"],
            diff=None
        ))
    else:
        # Run against public sample test cases only
        sample_tests = [tc for tc in question.test_cases if not tc.is_hidden]
        if not sample_tests:
            # If no sample test exists, run once with empty input
            sample_tests = [TestCase(id=0, input_data="", expected_output="", is_hidden=False)]

        for tc in sample_tests:
            exec_res = execution_engine.run_single_test(
                code=run_req.code,
                input_data=tc.input_data,
                expected_output=tc.expected_output
            )
            results.append(SingleTestRunResult(
                test_case_id=tc.id if tc.id != 0 else None,
                is_hidden=False,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                actual_output=exec_res["actual_output"],
                stdout=exec_res["stdout"],
                stderr=exec_res["stderr"],
                execution_time_ms=exec_res["execution_time_ms"],
                status=exec_res["status"],
                diff=exec_res["diff"]
            ))

    passed_count = sum(1 for r in results if r.status == "Passed")
    overall_status = "Success" if passed_count == len(results) else "Failed"

    return RunCodeResponse(
        status=overall_status,
        total_tests=len(results),
        passed_tests=passed_count,
        results=results
    )

@router.post("/submit", response_model=SubmitCodeResponse)
def submit_code(
    sub_req: SubmitCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    question = db.query(Question).filter(Question.id == sub_req.question_id).first()
    if not question or question.assignment_id != sub_req.assignment_id:
        raise HTTPException(status_code=404, detail="Question not found")
    ensure_can_access_assignment(db, question.assignment_id, current_user)
    require_active_attempt(db, question.assignment_id, current_user)

    test_cases = question.test_cases
    if not test_cases:
        # Fallback single test
        test_cases = [TestCase(id=0, input_data="", expected_output="", is_hidden=False)]

    results = []
    passed_count = 0
    first_failure_status = None

    for tc in test_cases:
        exec_res = execution_engine.run_single_test(
            code=sub_req.code,
            input_data=tc.input_data,
            expected_output=tc.expected_output
        )

        is_passed = (exec_res["status"] == "Passed")
        if is_passed:
            passed_count += 1
        elif first_failure_status is None:
            first_failure_status = exec_res["status"]

        # For hidden test cases, don't expose actual/expected inputs to the student
        if tc.is_hidden:
            results.append(SingleTestRunResult(
                test_case_id=tc.id,
                is_hidden=True,
                input_data=None,
                expected_output=None,
                actual_output=None,
                stdout=None,
                stderr=exec_res["stderr"] if not is_passed else None,
                execution_time_ms=exec_res["execution_time_ms"],
                status=exec_res["status"],
                diff=None
            ))
        else:
            results.append(SingleTestRunResult(
                test_case_id=tc.id,
                is_hidden=False,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                actual_output=exec_res["actual_output"],
                stdout=exec_res["stdout"],
                stderr=exec_res["stderr"],
                execution_time_ms=exec_res["execution_time_ms"],
                status=exec_res["status"],
                diff=exec_res["diff"]
            ))

    total_tests = len(test_cases)
    overall_status = "Accepted" if passed_count == total_tests else (first_failure_status or "Wrong Answer")
    score = round((passed_count / total_tests) * question.points, 2)

    # Persist submission in database
    submission = Submission(
        assignment_id=sub_req.assignment_id,
        question_id=sub_req.question_id,
        student_id=current_user.id,
        code=sub_req.code,
        status=overall_status,
        score=score,
        passed_cases=passed_count,
        total_cases=total_tests
    )
    db.add(submission)
    db.flush()

    for r in results:
        if r.test_case_id and r.test_case_id != 0:
            tr = TestResult(
                submission_id=submission.id,
                test_case_id=r.test_case_id,
                status=r.status.lower(),
                actual_output=r.actual_output or "",
                execution_time_ms=r.execution_time_ms,
                error_message=r.stderr
            )
            db.add(tr)

    db.commit()
    db.refresh(submission)

    return SubmitCodeResponse(
        submission_id=submission.id,
        status=overall_status,
        score=score,
        passed_cases=passed_count,
        total_cases=total_tests,
        results=results
    )
