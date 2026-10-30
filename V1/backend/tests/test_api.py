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

def test_auth_config(client):
    res = client.get("/api/auth/config")
    assert res.status_code == 200
    assert res.json() == {"google_client_id": "test-client-id.apps.googleusercontent.com"}

def test_password_login_removed(client):
    res = client.post("/api/auth/login", json={"email": "admin@gip.com", "password": "admin123"})
    assert res.status_code in (404, 405)

def test_google_login_rejects_uninvited(client, fake_google):
    res = client.post("/api/auth/google", json={"credential": "stranger@example.com"})
    assert res.status_code == 403

def test_google_login_rejects_invalid_token(client, fake_google):
    res = client.post("/api/auth/google", json={"credential": "bad"})
    assert res.status_code == 401

def test_google_login_bootstraps_admin(client, fake_google):
    res = client.post("/api/auth/google", json={"credential": "boss@example.com"})
    assert res.status_code == 200
    user = res.json()["user"]
    assert user["role"] == "admin"
    assert user["status"] == "active"

def test_student_cannot_use_admin_endpoints(client, student_headers):
    assert client.get("/api/admin/students", headers=student_headers).status_code == 403
    assert client.post("/api/assignments", json={"title": "x"}, headers=student_headers).status_code == 403

def test_bulk_invite_then_google_login(client, admin_headers, fake_google):
    tests = client.get("/api/assignments", headers=admin_headers).json()
    sample_id = next(t["id"] for t in tests if t["title"] == "GIP Python Screening Test")

    res = client.post("/api/admin/students/invite", json={
        "students": [
            {"email": "Alice@Example.com", "name": "Alice"},
            {"email": "bob@example.com"},
            {"email": "alice@example.com"},
            {"email": "boss@example.com"},
            {"email": "not-an-email"},
        ],
        "assignment_ids": [sample_id]
    }, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert sorted(u["email"] for u in data["invited"]) == ["alice@example.com", "bob@example.com"]
    assert data["already_exists"] == ["boss@example.com"]
    assert data["invalid"] == ["not-an-email"]
    assert all(u["status"] == "invited" for u in data["invited"])

    # Invited student signs in with Google and sees the assigned test
    login = client.post("/api/auth/google", json={"credential": "alice@example.com"})
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "student"
    assert login.json()["user"]["status"] == "active"
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    my_tests = client.get("/api/assignments", headers=headers).json()
    assert [t["id"] for t in my_tests] == [sample_id]

def test_admin_creates_and_assigns_test(client, admin_headers, student_headers):
    students = client.get("/api/admin/students", headers=admin_headers).json()
    demo = next(s for s in students if s["email"] == "student@example.com")

    created = client.post("/api/assignments", json={
        "title": "Quiz 1", "time_limit_minutes": 20
    }, headers=admin_headers)
    assert created.status_code == 200
    test_id = created.json()["id"]
    assert created.json()["assigned_students"] == []

    # Not assigned yet: student can't see or open it
    my_ids = [t["id"] for t in client.get("/api/assignments", headers=student_headers).json()]
    assert test_id not in my_ids
    assert client.get(f"/api/assignments/{test_id}", headers=student_headers).status_code == 403

    q = client.post(f"/api/assignments/{test_id}/questions", json={
        "title": "Echo",
        "problem_statement": "Echo input",
        "test_cases": [
            {"input_data": "hi", "expected_output": "hi"},
            {"input_data": "yo", "expected_output": "yo", "is_hidden": True}
        ]
    }, headers=admin_headers)
    assert q.status_code == 200
    question_id = q.json()["id"]
    run_res = client.post("/api/code/run", json={"question_id": question_id, "code": "print(input())"}, headers=student_headers)
    assert run_res.status_code == 403

    upd = client.put(f"/api/assignments/{test_id}/assignees", json={"student_ids": [demo["id"]]}, headers=admin_headers)
    assert upd.status_code == 200
    assert [s["email"] for s in upd.json()["assigned_students"]] == ["student@example.com"]

    detail = client.get(f"/api/assignments/{test_id}", headers=student_headers)
    assert detail.status_code == 200
    assert len(detail.json()["questions"][0]["sample_test_cases"]) == 1

    # Code can't run until the test is started
    assert client.post("/api/code/run", json={"question_id": question_id, "code": "print(input())"}, headers=student_headers).status_code == 409
    assert client.post(f"/api/assignments/{test_id}/attempt/start", headers=student_headers).status_code == 200

    sub = client.post("/api/code/submit", json={
        "assignment_id": test_id, "question_id": question_id, "code": "print(input())"
    }, headers=student_headers)
    assert sub.status_code == 200
    assert sub.json()["passed_cases"] == 2
    assert sub.json()["status"] == "Accepted"

    assert client.delete(f"/api/assignments/{test_id}", headers=admin_headers).status_code == 200

def test_seeded_test_for_student(client, admin_headers, student_headers):
    headers = student_headers
    students = client.get("/api/admin/students", headers=admin_headers).json()
    student_id = next(s["id"] for s in students if s["email"] == "student@example.com")
    sample = next(t for t in client.get("/api/assignments", headers=admin_headers).json()
                  if t["title"] == "GIP Python Screening Test")
    client.put(f"/api/assignments/{sample['id']}/assignees", json={"student_ids": [student_id]}, headers=admin_headers)

    tests_res = client.get("/api/assignments", headers=headers)
    assert tests_res.status_code == 200
    assignment_id = next(t["id"] for t in tests_res.json() if t["title"] == "GIP Python Screening Test")
    start = client.post(f"/api/assignments/{assignment_id}/attempt/start", headers=headers)
    assert start.status_code == 200
    assert 0 < start.json()["seconds_remaining"] <= 45 * 60

    # Fetch test detail as student
    assign_res = client.get(f"/api/assignments/{assignment_id}", headers=headers)
    assert assign_res.status_code == 200
    assign_data = assign_res.json()
    assert len(assign_data["questions"]) == 4
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

def test_seed_removes_legacy_demo_accounts(client, admin_headers):
    from app.database import SessionLocal
    from app.models.user import User
    from app.seed import seed_database

    db = SessionLocal()
    db.add(User(name="Old Demo", email="student@gip.com", role="student"))
    db.commit()
    db.close()

    seed_database()

    db = SessionLocal()
    assert db.query(User).filter(User.email == "student@gip.com").first() is None
    db.close()


def test_strikes_lock_then_admin_reset(client, admin_headers, student_headers):
    students = client.get("/api/admin/students", headers=admin_headers).json()
    student_id = next(s["id"] for s in students if s["email"] == "student@example.com")
    test_id = client.post("/api/assignments", json={
        "title": "Strike Test", "max_strikes": 2, "student_ids": [student_id]
    }, headers=admin_headers).json()["id"]
    q_id = client.post(f"/api/assignments/{test_id}/questions", json={
        "title": "Echo", "problem_statement": "Echo", "test_cases": [{"input_data": "a", "expected_output": "a"}]
    }, headers=admin_headers).json()["id"]

    # Events before starting are rejected
    ev = {"assignment_id": test_id, "event_type": "tab_switch", "details": "x"}
    assert client.post("/api/proctoring/events", json=ev, headers=student_headers).status_code == 409

    assert client.get(f"/api/assignments/{test_id}/attempt", headers=student_headers).json() is None
    attempt = client.post(f"/api/assignments/{test_id}/attempt/start", headers=student_headers).json()
    assert (attempt["strikes"], attempt["allowed_strikes"], attempt["status"]) == (0, 2, "in_progress")

    # Logged-only events don't count; the client-sent strike_count is ignored
    res = client.post("/api/proctoring/events", json={**ev, "event_type": "copy_blocked", "counts_as_strike": False, "strike_count": 99}, headers=student_headers)
    assert res.json()["attempt"]["strikes"] == 0

    assert client.post("/api/proctoring/events", json=ev, headers=student_headers).json()["attempt"]["strikes"] == 1
    locked = client.post("/api/proctoring/events", json=ev, headers=student_headers).json()["attempt"]
    assert (locked["strikes"], locked["status"]) == (2, "locked")

    # Locked: no code execution, and further events don't add strikes
    run = client.post("/api/code/run", json={"question_id": q_id, "code": "print(input())"}, headers=student_headers)
    assert run.status_code == 423
    assert client.post("/api/proctoring/events", json=ev, headers=student_headers).json()["attempt"]["strikes"] == 2

    # Resuming keeps the lock; students can't reset themselves
    assert client.post(f"/api/assignments/{test_id}/attempt/start", headers=student_headers).json()["status"] == "locked"
    assert client.post(f"/api/assignments/{test_id}/attempts/{student_id}/reset", json={"allowed_strikes": 5}, headers=student_headers).status_code == 403

    # Admin resets and grants 5 strikes
    reset = client.post(f"/api/assignments/{test_id}/attempts/{student_id}/reset", json={"allowed_strikes": 5}, headers=admin_headers)
    assert reset.status_code == 200
    assert (reset.json()["strikes"], reset.json()["allowed_strikes"], reset.json()["status"]) == (0, 5, "in_progress")
    assert client.post("/api/code/run", json={"question_id": q_id, "code": "print(input())"}, headers=student_headers).status_code == 200

    attempts = client.get(f"/api/assignments/{test_id}/attempts", headers=admin_headers).json()
    assert [a["student"]["email"] for a in attempts] == ["student@example.com"]

    assert client.get(f"/api/assignments/{test_id}/attempt", headers=student_headers).json()["status"] == "in_progress"

    # Finishing closes the attempt for good
    assert client.post(f"/api/assignments/{test_id}/attempt/finish", headers=student_headers).json()["status"] == "submitted"
    assert client.post("/api/code/run", json={"question_id": q_id, "code": "print(input())"}, headers=student_headers).status_code == 409
    assert client.post(f"/api/assignments/{test_id}/attempts/{student_id}/reset", json={"allowed_strikes": 3}, headers=admin_headers).status_code == 409
