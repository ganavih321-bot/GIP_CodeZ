from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.user import UserOut

class ProctoringEventCreate(BaseModel):
    assignment_id: int
    event_type: str  # "tab_switch" | "fullscreen_exit" | "copy_paste_attempt" | "screen_disconnected"
    severity: str = "medium"
    strike_count: int = 1
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
