import json
from datetime import datetime
from typing import List

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..models.session import ExamSession, SessionStatus
from ..models.user import Role, User
from ..schemas.session import ActiveSessionResponse
from ..services.rbac import require_role
from ..services.violation_scorer import get_session_risk

router = APIRouter()
settings = get_settings()


@router.get("/active-sessions", response_model=List[ActiveSessionResponse])
async def active_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.PROCTOR)),
):
    result = await db.execute(
        select(ExamSession, User)
        .join(User, ExamSession.student_id == User.id)
        .where(ExamSession.status == SessionStatus.ACTIVE)
        .order_by(ExamSession.started_at.desc())
    )
    rows = result.all()

    sessions = []
    for session, student in rows:
        risk = await get_session_risk(session.id, db)
        sessions.append(ActiveSessionResponse(
            session_id=session.id,
            student_name=student.full_name,
            exam_id=session.exam_id,
            start_time=session.started_at,
            violation_count=risk["count"],
            risk_level=risk["risk_level"],
        ))
    return sessions


@router.post("/sessions/{session_id}/terminate", status_code=status.HTTP_200_OK)
async def terminate_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.PROCTOR)),
):
    result = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail=f"Session is already {session.status.value}")

    session.status = SessionStatus.TERMINATED
    session.ended_at = datetime.utcnow()
    await db.flush()

    # Push termination message to student WebSocket via Redis
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    payload = json.dumps({
        "type": "termination",
        "session_id": session_id,
        "message": "Your exam session has been terminated by a proctor.",
        "timestamp": datetime.utcnow().isoformat(),
    })
    await r.publish(f"student:{session_id}", payload)
    await r.aclose()

    return {"detail": "Session terminated", "session_id": session_id}
