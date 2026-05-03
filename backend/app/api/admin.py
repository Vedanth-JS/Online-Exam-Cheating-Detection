from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import base, models

router = APIRouter()

@router.get("/dashboard/stats")
def get_stats(db: Session = Depends(base.get_db)):
    active_attempts = db.query(models.ExamAttempt).filter(models.ExamAttempt.status == "started").count()
    total_violations = db.query(models.Violation).count()
    return {
        "active_candidates": active_attempts,
        "total_violations": total_violations
    }

@router.get("/violations/recent")
def get_recent_violations(db: Session = Depends(base.get_db)):
    return db.query(models.Violation).order_by(models.Violation.timestamp.desc()).limit(20).all()
