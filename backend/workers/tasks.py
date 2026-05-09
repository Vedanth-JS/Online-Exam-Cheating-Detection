"""
Celery tasks for async frame processing and report generation.
"""
import json
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional

import redis
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# ─── Sync DB session for Celery workers ──────────────────────────────────────
import os  # noqa: E402

SYNC_DATABASE_URL = os.getenv(
    "SYNC_DATABASE_URL",
    os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/exam_db")
    .replace("postgresql+asyncpg://", "postgresql://")
    .replace("+asyncpg", ""),
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_sync_engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
SyncSession = sessionmaker(bind=_sync_engine)

# Import models
import sys  # noqa: E402
import pathlib  # noqa: E402
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
from app.models.violation import ViolationEvent, ViolationType  # noqa: E402

# ─── Redis publisher ──────────────────────────────────────────────────────────

def _publish_alert(session_id: str, payload: dict) -> None:
    r = redis.from_url(REDIS_URL, decode_responses=True)
    try:
        r.publish(f"proctor:{session_id}", json.dumps(payload))
    finally:
        r.close()


# ─── Violation insertion (sync) ───────────────────────────────────────────────

def _insert_violation(
    db: Session,
    session_id: str,
    vtype: ViolationType,
    confidence: float,
    frame_url: Optional[str] = None,
) -> ViolationEvent:
    v = ViolationEvent(
        id=str(uuid.uuid4()),
        session_id=session_id,
        type=vtype,
        confidence=round(confidence, 4),
        frame_url=frame_url,
        created_at=datetime.utcnow(),
    )
    db.add(v)
    db.commit()
    return v


# ─── ML runners (run in thread pool to avoid blocking) ────────────────────────

def _run_yolo(frame_b64: str) -> list[dict]:
    try:
        from ml.yolo_service import detect_objects
        return detect_objects(frame_b64)
    except Exception as e:
        logger.error(f"YOLO error: {e}")
        return []


def _run_gaze(frame_b64: str) -> dict:
    try:
        from ml.gaze_service import analyze_gaze
        return analyze_gaze(frame_b64)
    except Exception as e:
        logger.error(f"Gaze error: {e}")
        return {"direction": "CENTER", "confidence": 0.0, "duration_ms": 0}


def _run_audio(audio_b64: str) -> dict:
    try:
        from ml.audio_service import analyze_audio
        return analyze_audio(audio_b64)
    except Exception as e:
        logger.error(f"Audio error: {e}")
        return {"speech_detected": False, "energy_level": 0.0, "duration_ms": 0}


# ─── Main Task ────────────────────────────────────────────────────────────────

@celery_app.task(name="workers.tasks.process_frame", bind=True, max_retries=2)
def process_frame(
    self,
    session_id: str,
    frame_b64: str,
    audio_b64: Optional[str] = None,
    event_type: Optional[str] = None,
):
    """
    Process a single video frame (and optional audio) for cheating detection.

    - Runs YOLO + Gaze in parallel via ThreadPoolExecutor
    - Runs audio if audio_b64 provided
    - Inserts ViolationEvent rows for each detection above threshold
    - Publishes alert to Redis proctor:{session_id} channel
    """
    try:
        # Handle explicit event type (e.g. TAB_SWITCH) — no ML needed
        if event_type == "TAB_SWITCH":
            with SyncSession() as db:
                v = _insert_violation(db, session_id, ViolationType.TAB_SWITCH, 1.0)
                _publish_alert(session_id, {
                    "session_id": session_id,
                    "violation_type": "TAB_SWITCH",
                    "confidence": 1.0,
                    "frame_url": None,
                    "timestamp": datetime.utcnow().isoformat(),
                })
            return {"status": "tab_switch_logged"}

        if not frame_b64:
            return {"status": "no_frame"}

        # Run YOLO + Gaze in parallel threads
        with ThreadPoolExecutor(max_workers=2) as executor:
            yolo_future = executor.submit(_run_yolo, frame_b64)
            gaze_future = executor.submit(_run_gaze, frame_b64)
            yolo_results = yolo_future.result()
            gaze_result  = gaze_future.result()

        # Optionally run audio
        audio_result = None
        if audio_b64:
            audio_result = _run_audio(audio_b64)

        violations_logged = []

        with SyncSession() as db:
            # ── OBJECT violations ──
            for obj in yolo_results:
                label = obj.get("label", "")
                conf = obj.get("confidence", 0.0)
                if conf >= 0.65:
                    v = _insert_violation(db, session_id, ViolationType.OBJECT, conf)
                    alert = {
                        "session_id": session_id,
                        "violation_type": "OBJECT",
                        "detail": label,
                        "confidence": conf,
                        "frame_url": v.frame_url,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                    _publish_alert(session_id, alert)
                    violations_logged.append(alert)

            # ── GAZE violation ──
            direction = gaze_result.get("direction", "CENTER")
            gaze_conf = gaze_result.get("confidence", 0.0)
            if direction not in ("CENTER",) and gaze_conf >= 0.7:
                v = _insert_violation(db, session_id, ViolationType.GAZE, gaze_conf)
                alert = {
                    "session_id": session_id,
                    "violation_type": "GAZE",
                    "detail": direction,
                    "confidence": gaze_conf,
                    "frame_url": v.frame_url,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                _publish_alert(session_id, alert)
                violations_logged.append(alert)

            # ── AUDIO violation ──
            if audio_result and audio_result.get("speech_detected"):
                energy = audio_result.get("energy_level", 0.0)
                v = _insert_violation(db, session_id, ViolationType.AUDIO, min(energy * 10, 1.0))
                alert = {
                    "session_id": session_id,
                    "violation_type": "AUDIO",
                    "confidence": v.confidence,
                    "frame_url": None,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                _publish_alert(session_id, alert)
                violations_logged.append(alert)

        return {
            "status": "processed",
            "session_id": session_id,
            "violations": len(violations_logged),
        }

    except Exception as exc:
        logger.error(f"process_frame task failed: {exc}")
        raise self.retry(exc=exc, countdown=5)


# ─── Report Task ──────────────────────────────────────────────────────────────

@celery_app.task(name="workers.tasks.generate_session_report")
def generate_session_report(session_id: str) -> dict:
    """Return violation count summary for a session."""
    try:
        with SyncSession() as db:
            count = db.query(func.count(ViolationEvent.id)).filter(
                ViolationEvent.session_id == session_id
            ).scalar()
            return {"session_id": session_id, "violation_count": count or 0}
    except Exception as e:
        logger.error(f"generate_session_report error: {e}")
        return {"session_id": session_id, "violation_count": 0, "error": str(e)}
