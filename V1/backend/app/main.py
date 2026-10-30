from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import engine, Base, ensure_database_exists
from app.seed import seed_database
from app.routers import (
    auth,
    students,
    assignments,
    questions,
    code,
    submissions,
    proctoring,
    attempts
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create the database, tables and seed default accounts
    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield
    # Shutdown

app = FastAPI(
    title="GIP_CodeZ API",
    description="Anti-cheat proctored Python code assessments with Google login, admin-managed students and assigned tests.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(students.router, prefix=settings.API_V1_STR)
app.include_router(assignments.router, prefix=settings.API_V1_STR)
app.include_router(questions.router, prefix=settings.API_V1_STR)
app.include_router(code.router, prefix=settings.API_V1_STR)
app.include_router(submissions.router, prefix=settings.API_V1_STR)
app.include_router(proctoring.router, prefix=settings.API_V1_STR)
app.include_router(attempts.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "app": "GIP_CodeZ",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs"
    }

@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {"status": "healthy"}
