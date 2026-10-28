from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # tab_switch, fullscreen_exit, copy_paste_attempt, etc.
    severity = Column(String(20), default="medium", nullable=False)  # low, medium, high
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    details = Column(Text, nullable=True)  # JSON or text description of event
    strike_count = Column(Integer, default=1, nullable=False)

    # Relationships
    assignment = relationship("Assignment", back_populates="proctoring_events")
    student = relationship("User", back_populates="proctoring_events")
