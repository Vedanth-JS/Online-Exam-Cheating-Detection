from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import base, models
from ..tasks.celery_app import process_violation_snapshot

router = APIRouter()

class ViolationCreate(BaseModel):
    attempt_id: int
    type: str  # tab_switch, multi_face, audio, devtools
    severity: str
    metadata_info: Optional[dict] = None

@router.post("/violation")
def log_violation(violation: ViolationCreate, db: Session = Depends(base.get_db)):
    new_violation = models.Violation(
        attempt_id=violation.attempt_id,
        type=violation.type,
        severity=violation.severity,
        metadata_info=violation.metadata_info
    )
    db.add(new_violation)
    db.commit()
    db.refresh(new_violation)
    return {"status": "violation logged", "id": new_violation.id}

@router.post("/snapshot/{violation_id}")
async def upload_snapshot(violation_id: int, file: UploadFile = File(...), db: Session = Depends(base.get_db)):
    # Save file locally or to S3, then trigger Celery task for AI analysis
    # For now, we just mock the URL and trigger task
    file_content = await file.read()
    process_violation_snapshot.delay(violation_id, file_content.hex()) # Send as hex for simplicity in this example
    return {"status": "snapshot uploaded and processing"}
