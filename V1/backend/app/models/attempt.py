from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class ExamAttempt(Base):
    """A student's sitting of a test: server-side strikes, lock state and timer."""
    __tablename__ = "exam_attempts"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id", name="_attempt_student_uc"),)

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    strikes = Column(Integer, default=0, nullable=False)
    allowed_strikes = Column(Integer, nullable=False)  # Starts at the test's max_strikes; admin can change on reset
    status = Column(String(20), default="in_progress", nullable=False)  # in_progress | locked | submitted
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at = Column(DateTime, nullable=True)

    assignment = relationship("Assignment", back_populates="attempts")
    student = relationship("User", back_populates="attempts")

    @property
    def seconds_remaining(self) -> int:
        limit = self.assignment.time_limit_minutes
        if not limit:
            return 0
        started = self.started_at
        if started.tzinfo is None:  # SQLite drops tzinfo
            started = started.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        return max(0, int(limit * 60 - elapsed))
