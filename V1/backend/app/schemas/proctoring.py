from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.user import UserOut

class ProctoringEventCreate(BaseModel):
    assignment_id: int
    event_type: str  # "tab_switch" | "fullscreen_exit" | "copy_paste_attempt" | "screen_disconnected"
    severity: str = "medium"
    strike_count: int = 1  # Ignored: the server counts strikes
    counts_as_strike: bool = True  # False for logged-only events (e.g. blocked copy/paste)
    details: Optional[str] = None

class ProctoringEventOut(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    event_type: str
    severity: str
    strike_count: int
    timestamp: datetime
    details: Optional[str] = None
    has_screenshot: bool = False
    student: Optional[UserOut] = None
    model_config = ConfigDict(from_attributes=True)

class ActiveStudentSession(BaseModel):
    student_id: int
    student_name: str
    student_email: str
    assignment_id: int
    has_screen_stream: bool = False
    is_fullscreen: bool = True
    current_strikes: int = 0
    last_event: Optional[str] = None
    last_event_time: Optional[datetime] = None

class AttemptOut(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    student: Optional[UserOut] = None
    strikes: int
    allowed_strikes: int
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    seconds_remaining: int = 0
    model_config = ConfigDict(from_attributes=True)

class ViolationResult(BaseModel):
    event: ProctoringEventOut
    attempt: AttemptOut

class StrikeReset(BaseModel):
    allowed_strikes: int = Field(ge=1, le=50)

class ScreenshotUpload(BaseModel):
    image: str  # JPEG data URL

class ScreenshotOut(BaseModel):
    event_id: int
    image: str
