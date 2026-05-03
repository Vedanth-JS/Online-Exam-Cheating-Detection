from datetime import datetime
from pydantic import BaseModel
from ..models.session import SessionStatus


class SessionCreate(BaseModel):
    exam_id: str


class SessionResponse(BaseModel):
    id: str
    student_id: str
    exam_id: str
    status: SessionStatus
    started_at: datetime
    ended_at: datetime | None = None

    model_config = {"from_attributes": True}


class ActiveSessionResponse(BaseModel):
    session_id: str
    student_name: str
    exam_id: str
    start_time: datetime
    violation_count: int
    risk_level: str
