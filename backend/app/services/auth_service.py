import uuid
from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
import redis.asyncio as aioredis

from ..config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password helpers ─────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── JWT helpers ──────────────────────────────────────────────────────────────

def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload["jti"] = str(uuid.uuid4())
    payload["type"] = "access"
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload["jti"] = str(uuid.uuid4())
    payload["type"] = "refresh"
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


# ─── Redis refresh token storage ──────────────────────────────────────────────

def _redis_client() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def store_refresh_token(user_id: str, token: str) -> None:
    r = _redis_client()
    key = f"refresh:{user_id}"
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await r.setex(key, ttl, token)
    await r.aclose()


async def validate_refresh_token(user_id: str, token: str) -> bool:
    r = _redis_client()
    key = f"refresh:{user_id}"
    stored = await r.get(key)
    await r.aclose()
    return stored == token


async def revoke_refresh_token(user_id: str) -> None:
    r = _redis_client()
    await r.delete(f"refresh:{user_id}")
    await r.aclose()
