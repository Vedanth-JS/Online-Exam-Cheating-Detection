from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, exams, proctor, admin
from .db.base import engine, Base

# Create tables (for development, better use Alembic in prod)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Advanced AI Proctoring Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(exams.router, prefix="/exams", tags=["Exams"])
app.include_router(proctor.router, prefix="/proctor", tags=["Proctoring"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

@app.get("/")
async def root():
    return {"message": "Advanced Online Assessment API is live"}
