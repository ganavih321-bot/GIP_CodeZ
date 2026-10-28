import pytest
from app.services.code_runner import execution_engine

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_code_runner_python_success():
    code = "import sys\nprint('Hello ' + sys.stdin.read().strip())"
    res = execution_engine.run_single_test(code, "World", "Hello World")
    assert res["status"] == "Passed"
    assert res["actual_output"] == "Hello World"
    assert res["diff"] is None

def test_code_runner_python_wrong_answer():
    code = "print(42)"
    res = execution_engine.run_single_test(code, "", "100")
    assert res["status"] == "Wrong Answer"
    assert res["diff"] is not None

def test_code_runner_runtime_error():
    code = "print(1 / 0)"
    res = execution_engine.run_single_test(code, "", "0")
    assert res["status"] == "Runtime Error"
    assert "ZeroDivisionError" in res["stderr"]

def test_code_runner_timeout():
    code = "while True:\n    pass"
    from app.services.code_runner import ExecutionEngine
    quick_engine = ExecutionEngine(timeout=1)
    res = quick_engine.run_single_test(code, "", "done")
    assert res["status"] == "Time Limit Exceeded"

def test_teacher_login(client):
    response = client.post("/api/auth/login", json={
        "email": "teacher@gip.com",
        "password": "teacher123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "teacher"

def test_student_login(client):
    response = client.post("/api/auth/login", json={
        "email": "student@gip.com",
        "password": "student123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "student"

def test_seeded_classroom_and_assignment(client):
    # Login as student
    login_res = client.post("/api/auth/login", json={
        "email": "student@gip.com",
        "password": "student123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch classrooms
    class_res = client.get("/api/classrooms", headers=headers)
    assert class_res.status_code == 200
    classes = class_res.json()
    assert len(classes) >= 1
    class_id = classes[0]["id"]

    # Fetch classroom detail
    detail_res = client.get(f"/api/classrooms/{class_id}", headers=headers)
    assert detail_res.status_code == 200
    classroom_data = detail_res.json()
    assert len(classroom_data["assignments"]) >= 1

    assignment_id = classroom_data["assignments"][0]["id"]

    # Fetch assignment detail as student
    assign_res = client.get(f"/api/assignments/{assignment_id}", headers=headers)
    assert assign_res.status_code == 200
    assign_data = assign_res.json()
    assert len(assign_data["questions"]) >= 1
    first_q = assign_data["questions"][0]
    
    # Check that student only sees sample test cases
    for tc in first_q["sample_test_cases"]:
        assert tc["is_hidden"] is False

    # Test run code
    run_res = client.post("/api/code/run", json={
        "question_id": first_q["id"],
        "code": first_q["starter_code"]
    }, headers=headers)
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["total_tests"] >= 1
    assert "results" in run_data
