import os
import tempfile

# Configure an isolated SQLite database and test settings before the app is imported
_db_dir = tempfile.mkdtemp(prefix="gip_codez_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_db_dir, 'test.db')}"
os.environ["GOOGLE_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"
os.environ["ADMIN_EMAILS"] = "boss@example.com"

import pytest
from app.database import engine, Base
from app.seed import seed_database
from app.main import app
from fastapi.testclient import TestClient

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def fake_google(monkeypatch):
    """Replace Google token verification: the credential string is used as the email."""
    from app.routers import auth

    def verify(credential):
        if credential == "bad":
            raise ValueError("invalid token")
        return {
            "sub": f"google-{credential}",
            "email": credential,
            "email_verified": True,
            "name": credential.split("@")[0].title()
        }

    monkeypatch.setattr(auth, "verify_google_token", verify)

def google_headers(client, email):
    res = client.post("/api/auth/google", json={"credential": email})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}

@pytest.fixture
def admin_headers(client, fake_google):
    return google_headers(client, "boss@example.com")

@pytest.fixture
def student_headers(client, admin_headers):
    """An invited student (student@example.com) signed in with Google."""
    client.post("/api/admin/students/invite", json={"students": [{"email": "student@example.com"}]}, headers=admin_headers)
    return google_headers(client, "student@example.com")
