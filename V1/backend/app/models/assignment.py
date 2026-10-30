from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(20), default="exam", nullable=False)  # "exam" | "homework"
    is_proctored = Column(Boolean, default=True, nullable=False)
    time_limit_minutes = Column(Integer, default=60, nullable=True)
    max_strikes = Column(Integer, default=3, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    assignees = relationship("AssignmentAssignee", back_populates="assignment", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="assignment", cascade="all, delete-orphan", order_by="Question.id")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")
    proctoring_events = relationship("ProctoringEvent", back_populates="assignment", cascade="all, delete-orphan")
    attempts = relationship("ExamAttempt", back_populates="assignment", cascade="all, delete-orphan")

    @property
    def assigned_students(self):
        return [a.student for a in self.assignees]

class AssignmentAssignee(Base):
    __tablename__ = "assignment_assignees"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id", name="_assignment_student_uc"),)

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    assignment = relationship("Assignment", back_populates="assignees")
    student = relationship("User", back_populates="assigned_tests")
