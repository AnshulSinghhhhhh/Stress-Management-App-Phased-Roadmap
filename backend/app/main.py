"""FastAPI application entry point for Stress Management App.
Per IMPLEMENTATION_PLAN.md §0.1, §0.2, §0.4, Phase 1, and Phase 2 §2.0.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine, SessionLocal
from app.models import User
from app.api.baseline import router as baseline_router
from app.api.checkins import router as checkins_router
from app.api.relief import router as relief_router
from app.api.crisis import router as crisis_router
from app.api.stress_index import router as stress_index_router
from app.api.export import router as export_router
from app.api.integrations import router as integrations_router
from app.api.triggers import router as triggers_router
from app.api.consent import router as consent_router

def init_db():
    """Create all database tables and seed demo user."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        demo = db.query(User).filter(User.id == "demo_user").first()
        if not demo:
            demo = User(
                id="demo_user",
                email="demo@example.com",
                locale="en",
                consent_version_accepted="1.0.0",
                data_retention_pref="standard"
            )
            db.add(demo)
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

# Ensure database tables and demo seed are initialized on import
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Stress Management API",
    description="Phase 1 + Phase 2 backend: stress detection, relief exercises, crisis response, and trigger taxonomy.",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers with /api/v1 prefix and root aliases
all_routers = [
    baseline_router,
    checkins_router,
    relief_router,
    crisis_router,
    stress_index_router,
    export_router,
    integrations_router,
    triggers_router,  # Phase 2 §2.0
    consent_router,   # Phase 2 v2
]

for router in all_routers:
    app.include_router(router, prefix="/api/v1")
    app.include_router(router)  # direct route alias for convenience

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": "stress-management-api",
        "phase": 2,
        "crisis_support": {
            "tele_manas": "14416",
            "kiran": "1800-599-0019",
            "emergency": "112"
        }
    }
