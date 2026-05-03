from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import engine, Base

# Import all models so Alembic / Base.metadata sees them
from .models import user, session, violation  # noqa: F401

from .routers import auth, sessions, violations, proctor, reports
from .websocket import session_ws, proctor_ws

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 ExamGuard API starting up...")
    # Tables are managed by Alembic in production; create for dev convenience
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    logger.info("ExamGuard API shutting down...")
    await engine.dispose()


app = FastAPI(
    title="ExamGuard AI Proctoring API",
    description="Production-grade exam proctoring platform with real-time ML detection",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/auth",       tags=["Authentication"])
app.include_router(sessions.router,   prefix="/sessions",   tags=["Sessions"])
app.include_router(violations.router, prefix="/violations", tags=["Violations"])
app.include_router(proctor.router,    prefix="/proctor",    tags=["Proctor"])
app.include_router(reports.router,    prefix="/reports",    tags=["Reports"])

# ─── WebSocket routes ─────────────────────────────────────────────────────────
app.include_router(session_ws.router,  tags=["WebSocket"])
app.include_router(proctor_ws.router,  tags=["WebSocket"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "ExamGuard AI Proctoring API", "version": "2.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
