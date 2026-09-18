"""Router: User baseline profile onboarding."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import BaselineProfile, User
from app.schemas import BaselineCreate, BaselineResponse

router = APIRouter(prefix="/baseline", tags=["Baseline"])

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

@router.post("", response_model=BaselineResponse, status_code=status.HTTP_200_OK)
@router.post("/", response_model=BaselineResponse, status_code=status.HTTP_200_OK, include_in_schema=False)
def store_baseline(
    payload: BaselineCreate,
    db: Session = Depends(get_db)
):
    """Store user baseline profile answers JSON.
    Cannot be accidentally re-triggered if baseline already exists for the user (returns existing profile).
    """
    user_id = payload.user_id or "demo_user"
    ensure_user_exists(db, user_id)

    # Check if baseline already exists
    existing = db.query(BaselineProfile).filter(BaselineProfile.user_id == user_id).first()
    if existing:
        return BaselineResponse(
            user_id=existing.user_id,
            answers_json=existing.answers_json,
            created_at=existing.created_at,
            status="already_exists"
        )

    # Create new baseline profile
    profile = BaselineProfile(
        user_id=user_id,
        answers_json=payload.answers
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return BaselineResponse(
        user_id=profile.user_id,
        answers_json=profile.answers_json,
        created_at=profile.created_at,
        status="created"
    )

@router.get("", response_model=BaselineResponse)
@router.get("/", response_model=BaselineResponse, include_in_schema=False)
def get_baseline(
    user_id: str = "demo_user",
    db: Session = Depends(get_db)
):
    """Fetch user's baseline profile."""
    profile = db.query(BaselineProfile).filter(BaselineProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Baseline profile not found for user: {user_id}"
        )
    return BaselineResponse(
        user_id=profile.user_id,
        answers_json=profile.answers_json,
        created_at=profile.created_at,
        status="exists"
    )
