from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(20), default="exam", nullable=False)  # "exam" | "homework"
    is_proctored = Column(Boolean, default=True, nullable=False)
    time_limit_minutes = Column(Integer, default=60, nullable=True)
    max_strikes = Column(Integer, default=3, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    classroom = relationship("Classroom", back_populates="assignments")
    questions = relationship("Question", back_populates="assignment", cascade="all, delete-orphan", order_by="Question.id")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")
    proctoring_events = relationship("ProctoringEvent", back_populates="assignment", cascade="all, delete-orphan")
