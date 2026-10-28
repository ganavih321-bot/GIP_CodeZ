from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="student", nullable=False)  # "teacher" | "student"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    classrooms_taught = relationship("Classroom", back_populates="teacher", cascade="all, delete-orphan")
    enrollments = relationship("ClassroomEnrollment", back_populates="student", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="student", cascade="all, delete-orphan")
    proctoring_events = relationship("ProctoringEvent", back_populates="student", cascade="all, delete-orphan")
