import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ViolationType(str, enum.Enum):
    GAZE = "GAZE"
    OBJECT = "OBJECT"
    AUDIO = "AUDIO"
    TAB_SWITCH = "TAB_SWITCH"


class ViolationEvent(Base):
    __tablename__ = "violation_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[ViolationType] = mapped_column(SAEnum(ViolationType), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    frame_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True
    )
