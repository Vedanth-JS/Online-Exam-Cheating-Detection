from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..models.violation import ViolationEvent, ViolationType


RISK_THRESHOLDS = {
    "LOW": (0, 2),
    "MEDIUM": (3, 5),
    "HIGH": (6, 10),
    "CRITICAL": (11, float("inf")),
}


def _compute_risk_level(count: int) -> str:
    if count <= 2:
        return "LOW"
    elif count <= 5:
        return "MEDIUM"
    elif count <= 10:
        return "HIGH"
    return "CRITICAL"


async def get_session_risk(session_id: str, db: AsyncSession) -> dict:
    """Return violation count, risk level, and per-type breakdown."""
    result = await db.execute(
        select(ViolationEvent.type, func.count(ViolationEvent.id).label("cnt"))
        .where(ViolationEvent.session_id == session_id)
        .group_by(ViolationEvent.type)
    )
    rows = result.all()

    breakdown = {t.value: 0 for t in ViolationType}
    total = 0
    for vtype, cnt in rows:
        breakdown[vtype.value] = cnt
        total += cnt

    return {
        "count": total,
        "risk_level": _compute_risk_level(total),
        "breakdown": breakdown,
    }
