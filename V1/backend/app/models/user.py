from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    google_sub = Column(String(255), unique=True, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    role = Column(String(20), default="student", nullable=False)  # "admin" | "student"
    status = Column(String(20), default="invited", nullable=False)  # "invited" | "active"
    invited_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    assigned_tests = relationship("AssignmentAssignee", back_populates="student", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="student", cascade="all, delete-orphan")
    proctoring_events = relationship("ProctoringEvent", back_populates="student", cascade="all, delete-orphan")
    attempts = relationship("ExamAttempt", back_populates="student", cascade="all, delete-orphan")
