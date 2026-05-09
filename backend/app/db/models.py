from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(String)  # admin, examiner, candidate
    is_active = Column(Boolean, default=True)
    face_encoding = Column(JSON, nullable=True)  # Store face features for verification

    attempts = relationship("ExamAttempt", back_populates="user")

class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    duration_minutes = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    creator_id = Column(Integer, ForeignKey("users.id"))
    config = Column(JSON)  # Proctoring settings (lockdown, audio, etc.)

    questions = relationship("Question", back_populates="exam")
    attempts = relationship("ExamAttempt", back_populates="exam")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"))
    text = Column(Text)
    type = Column(String)  # mcq, subjective
    options = Column(JSON, nullable=True)
    correct_answer = Column(Text)
    points = Column(Integer, default=1)

    exam = relationship("Exam", back_populates="questions")

class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    status = Column(String)  # started, completed, terminated
    score = Column(Float, nullable=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="attempts")
    exam = relationship("Exam", back_populates="attempts")
    violations = relationship("Violation", back_populates="attempt")

class Violation(Base):
    __tablename__ = "violations"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"))
    type = Column(String)  # tab_switch, multi_face, audio, devtools
    severity = Column(String)  # low, medium, high
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    snapshot_url = Column(String, nullable=True)
    metadata_info = Column(JSON, nullable=True)

    attempt = relationship("ExamAttempt", back_populates="violations")
