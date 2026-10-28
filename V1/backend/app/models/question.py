from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    title = Column(String(200), nullable=False)
    problem_statement = Column(Text, nullable=False)
    difficulty = Column(String(20), default="Medium", nullable=False)  # Easy, Medium, Hard
    starter_code = Column(Text, default="# Write your solution here\nimport sys\n\ndef main():\n    pass\n\nif __name__ == '__main__':\n    main()\n", nullable=False)
    constraints = Column(Text, nullable=True)
    points = Column(Integer, default=100, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    assignment = relationship("Assignment", back_populates="questions")
    test_cases = relationship("TestCase", back_populates="question", cascade="all, delete-orphan", order_by="TestCase.order_index")
    submissions = relationship("Submission", back_populates="question", cascade="all, delete-orphan")

class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    input_data = Column(Text, default="", nullable=False)
    expected_output = Column(Text, default="", nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False)  # False = Sample/Public, True = Hidden
    explanation = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)

    question = relationship("Question", back_populates="test_cases")
