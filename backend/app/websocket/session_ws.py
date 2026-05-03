import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError

from ..services.auth_service import decode_token
from ..services.violation_scorer import get_session_risk
from ..database import AsyncSessionLocal
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.websocket("/ws/session/{session_id}")
async def student_session_ws(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
):
    # Authenticate before accepting
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = payload.get("sub")
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    logger.info(f"Student WS connected: session={session_id} user={user_id}")

    # Import here to avoid circular imports
    from workers.tasks import process_frame

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON"})
                continue

            msg_type = msg.get("type")
            data = msg.get("data", "")

            if msg_type == "frame":
                audio_data = msg.get("audio")
                # Dispatch Celery task asynchronously
                process_frame.delay(session_id, data, audio_data)

                # Compute current risk and respond
                async with AsyncSessionLocal() as db:
                    risk = await get_session_risk(session_id, db)

                await websocket.send_json({
                    "type": "status",
                    "violations_count": risk["count"],
                    "risk_level": risk["risk_level"],
                })

            elif msg_type == "tab_switch":
                # Lightweight tab-switch event: no frame needed
                process_frame.delay(session_id, "", None, event_type="TAB_SWITCH")
                await websocket.send_json({"type": "ack", "event": "tab_switch"})

            else:
                await websocket.send_json({"type": "error", "detail": f"Unknown type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info(f"Student WS disconnected: session={session_id}")
    except Exception as e:
        logger.error(f"Student WS error: {e}")
        await websocket.close()
