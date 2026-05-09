import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.session import ExamSession, SessionStatus
from ..models.user import Role, User
from ..schemas.session import SessionCreate, SessionResponse
from ..services.rbac import require_role

router = APIRouter()


@router.post("/start", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def start_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    session = ExamSession(
        id=str(uuid.uuid4()),
        student_id=current_user.id,
        exam_id=body.exam_id,
        status=SessionStatus.ACTIVE,
        started_at=datetime.utcnow(),
    )
    db.add(session)
    await db.flush()
    return session


@router.patch("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    result = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Students can only end their own sessions; proctors/admins can end any
    if current_user.role == Role.STUDENT and session.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    if session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail=f"Session already {session.status.value}")

    session.status = SessionStatus.ENDED
    session.ended_at = datetime.utcnow()
    await db.flush()
    return session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    result = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
