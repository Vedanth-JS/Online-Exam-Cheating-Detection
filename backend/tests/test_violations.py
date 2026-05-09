"""
Tests for the violations API endpoints.
Uses pytest-asyncio + httpx AsyncClient with mocked DB.
"""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from app.main import app
from app.models.violation import ViolationType
from app.services.auth_service import create_access_token
from app.services.rbac import get_current_user
from app.database import get_db


# ─── Fixtures ────────────────────────────────────────────────────────────────

STUDENT_TOKEN = create_access_token({"sub": str(uuid.uuid4()), "role": "STUDENT"})
PROCTOR_TOKEN = create_access_token({"sub": str(uuid.uuid4()), "role": "PROCTOR"})
TEST_SESSION_ID = str(uuid.uuid4())
TEST_VIOLATION_ID = str(uuid.uuid4())

MOCK_USER = MagicMock()
MOCK_USER.id = str(uuid.uuid4())
MOCK_USER.role = MagicMock()
MOCK_USER.role.value = "STUDENT"
MOCK_USER.is_active = True


def _mock_violation(session_id: str = TEST_SESSION_ID) -> MagicMock:
    v = MagicMock()
    v.id = TEST_VIOLATION_ID
    v.session_id = session_id
    v.type = ViolationType.GAZE
    v.confidence = 0.87
    v.frame_url = None
    v.created_at = datetime.utcnow()
    return v


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ─── Test: POST /violations creates a record ──────────────────────────────────

@pytest.mark.asyncio
async def test_create_violation(client):
    """POST /violations should create and return a ViolationEvent."""
    mock_violation = _mock_violation()

    async def override_get_current_user():
        return MOCK_USER
        
    async def override_get_db():
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.add = MagicMock()
        yield mock_db

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db

    try:
        # Patch ViolationEvent constructor side effect to return mock
        with patch("app.routers.violations.ViolationEvent", return_value=mock_violation):
            response = await client.post(
                "/violations",
                json={
                    "session_id": TEST_SESSION_ID,
                    "type": "GAZE",
                    "confidence": 0.87,
                    "frame_url": None,
                },
                headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["session_id"] == TEST_SESSION_ID
        assert data["type"] == "GAZE"
        assert data["confidence"] == 0.87
    finally:
        app.dependency_overrides.clear()


# ─── Test: GET /violations/{session_id} returns list ──────────────────────────

@pytest.mark.asyncio
async def test_list_violations(client):
    """GET /violations/{session_id} should return a list of violations."""
    mock_violation = _mock_violation()

    async def override_get_current_user():
        return MOCK_USER
        
    async def override_get_db():
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_violation]
        mock_db.execute = AsyncMock(return_value=mock_result)
        yield mock_db

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db

    try:
        response = await client.get(
            f"/violations/{TEST_SESSION_ID}",
            headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["type"] == "GAZE"
    finally:
        app.dependency_overrides.clear()


# ─── Test: Unauthenticated request returns 401 ────────────────────────────────

@pytest.mark.asyncio
async def test_unauthenticated_request(client):
    """Requests without Bearer token should return 403."""
    response = await client.post(
        "/violations",
        json={
            "session_id": TEST_SESSION_ID,
            "type": "GAZE",
            "confidence": 0.87,
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_get(client):
    """GET without token should return 403."""
    response = await client.get(f"/violations/{TEST_SESSION_ID}")
    assert response.status_code == 403
