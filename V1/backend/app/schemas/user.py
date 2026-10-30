from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "student"  # "admin" | "student"

class GoogleLogin(BaseModel):
    credential: str  # Google ID token from Google Identity Services

class UserOut(UserBase):
    id: int
    status: str = "active"
    avatar_url: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class StudentOut(UserOut):
    assigned_tests_count: int = 0

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None

class AuthConfig(BaseModel):
    google_client_id: str

class StudentInvite(BaseModel):
    email: str
    name: Optional[str] = None

class BulkInviteRequest(BaseModel):
    students: List[StudentInvite]
    assignment_ids: List[int] = []  # Optionally assign these tests to every invited student

class BulkInviteResult(BaseModel):
    invited: List[UserOut] = []
    already_exists: List[str] = []
    invalid: List[str] = []
