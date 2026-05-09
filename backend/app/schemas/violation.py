from datetime import datetime

from pydantic import BaseModel

from ..models.violation import ViolationType


class ViolationCreate(BaseModel):
    session_id: str
    type: ViolationType
    confidence: float = 1.0
    frame_url: str | None = None


class ViolationResponse(BaseModel):
    id: str
    session_id: str
    type: ViolationType
    confidence: float
    frame_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
