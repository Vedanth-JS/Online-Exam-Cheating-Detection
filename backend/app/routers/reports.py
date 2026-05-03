from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from ..database import get_db
from ..models.user import User, Role
from ..models.session import ExamSession
from ..services.rbac import require_role
from ..services.report_service import generate_ai_summary, generate_pdf_report
from ..services.violation_scorer import get_session_risk

router = APIRouter()


@router.get("/{session_id}")
async def get_report_json(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.PROCTOR)),
):
    """Return JSON report: AI summary + risk breakdown."""
    result = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    summary = await generate_ai_summary(session_id, db)
    risk = await get_session_risk(session_id, db)

    return {
        "session_id": session_id,
        "summary": summary,
        "risk_level": risk["risk_level"],
        "violation_count": risk["count"],
        "breakdown": risk["breakdown"],
    }


@router.get("/{session_id}/pdf")
async def get_report_pdf(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.PROCTOR)),
):
    """Return full PDF proctoring report."""
    result = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        pdf_bytes = await generate_pdf_report(session_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{session_id[:8]}.pdf"},
    )
