"""Router: Relief techniques and active guided sessions."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import ReliefSession, User, utc_now
from app.schemas import ReliefSessionStart, ReliefSessionUpdate, ReliefSessionResponse
from app.services.recommender import get_all_techniques

router = APIRouter(prefix="/relief", tags=["Relief"])

def ensure_user_exists(db: Session, user_id: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            email=f"{user_id}@example.com" if "@" not in user_id else user_id,
            locale="en",
            consent_version_accepted="1.0.0",
            data_retention_pref="standard"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.get("/techniques", response_model=List[Dict[str, Any]])
def get_techniques():
    """Return all Phase 1 somatic relief techniques with timing scripts."""
    return get_all_techniques()

@router.post("/sessions", response_model=ReliefSessionResponse, status_code=status.HTTP_201_CREATED)
def start_relief_session(
    payload: ReliefSessionStart,
    db: Session = Depends(get_db)
):
    """Start an interactive relief exercise session."""
    user_id = payload.user_id or "demo_user"
    ensure_user_exists(db, user_id)

    session = ReliefSession(
        user_id=user_id,
        technique=payload.technique,
        checkin_id=payload.checkin_id,
        started_at=utc_now()
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.patch("/sessions/{session_id}", response_model=ReliefSessionResponse)
def complete_relief_session(
    session_id: str,
    payload: ReliefSessionUpdate,
    db: Session = Depends(get_db)
):
    """Complete an interactive relief exercise session with a self-rating (1 to 5)."""
    session = db.query(ReliefSession).filter(ReliefSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Relief session not found: {session_id}"
        )

    session.completed_at = utc_now()
    session.self_reported_relief = payload.self_reported_relief
    db.commit()
    db.refresh(session)
    return session
