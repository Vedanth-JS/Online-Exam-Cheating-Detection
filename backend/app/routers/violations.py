import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from ..database import get_db
from ..models.user import User, Role
from ..models.violation import ViolationEvent
from ..schemas.violation import ViolationCreate, ViolationResponse
from ..services.rbac import require_role

router = APIRouter()


@router.post("", response_model=ViolationResponse, status_code=201)
async def create_violation(
    body: ViolationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    violation = ViolationEvent(
        id=str(uuid.uuid4()),
        session_id=body.session_id,
        type=body.type,
        confidence=body.confidence,
        frame_url=body.frame_url,
    )
    db.add(violation)
    await db.flush()
    return violation


@router.get("/{session_id}", response_model=List[ViolationResponse])
async def list_violations(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.STUDENT)),
):
    result = await db.execute(
        select(ViolationEvent)
        .where(ViolationEvent.session_id == session_id)
        .order_by(ViolationEvent.created_at.asc())
    )
    return result.scalars().all()
