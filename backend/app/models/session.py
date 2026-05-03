import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class SessionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"
    TERMINATED = "TERMINATED"


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exam_id: Mapped[str] = mapped_column(String(36), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus), nullable=False, default=SessionStatus.ACTIVE
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
