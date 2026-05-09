import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError
import redis.asyncio as aioredis

from ..services.auth_service import decode_token
from ..models.user import Role
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# ─── Connection Manager ───────────────────────────────────────────────────────

class ProctorConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.add(ws)
        logger.info(f"Proctor connected. Total: {len(self._connections)}")

    def disconnect(self, ws: WebSocket):
        self._connections.discard(ws)
        logger.info(f"Proctor disconnected. Total: {len(self._connections)}")

    async def broadcast(self, message: str):
        dead = set()
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections.discard(ws)


manager = ProctorConnectionManager()


# ─── WebSocket Endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws/proctor")
async def proctor_ws(
    websocket: WebSocket,
    token: str = Query(...),
):
    # Authenticate and check PROCTOR role before accepting
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        role_str = payload.get("role", "")
        if role_str not in (Role.PROCTOR.value, Role.ADMIN.value):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)

    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()

    try:
        # Subscribe to all proctor alert channels + student termination acks
        await pubsub.psubscribe("proctor:*")

        async def _listen():
            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    await manager.broadcast(message["data"])

        listen_task = asyncio.create_task(_listen())

        # Keep connection alive; client can send pings
        try:
            while True:
                text = await websocket.receive_text()
                if text == "ping":
                    await websocket.send_text("pong")
        except WebSocketDisconnect:
            pass
        finally:
            listen_task.cancel()

    except Exception as e:
        logger.error(f"Proctor WS error: {e}")
    finally:
        manager.disconnect(websocket)
        await pubsub.punsubscribe("proctor:*")
        await pubsub.aclose()
        await r.aclose()
