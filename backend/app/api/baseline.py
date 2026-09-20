"""Router: User baseline profile onboarding & longitudinal recalibration."""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import BaselineProfile, BaselineSnapshot, User, utc_now
from app.schemas import (
    BaselineCreate, BaselineResponse,
    BaselineSnapshotCreate, BaselineSnapshotResponse
)
from app.services.questionnaire_catalog import (
    get_active_questionnaire_catalog,
    score_baseline_responses,
    ACTIVE_QUESTIONNAIRE_VERSION,
    ACTIVE_SCALE_VERSION
)

router = APIRouter(prefix="/baseline", tags=["Baseline"])

def ensure_user_exists(db: Session, user_id: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            email=f"{user_id}@example.com" if "@" not in user_id else user_id,
            locale="en",
            consent_version_accepted="2.0.0",
            data_retention_pref="standard"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.get("/catalog")
def get_catalog():
    """Fetch active questionnaire catalog (WHO-5 adapted + somatic lifestyle dimensions)."""
    return get_active_questionnaire_catalog()

@router.post("", response_model=BaselineResponse, status_code=status.HTTP_200_OK)
@router.post("/", response_model=BaselineResponse, status_code=status.HTTP_200_OK, include_in_schema=False)
def store_baseline(
    payload: BaselineCreate,
    db: Session = Depends(get_db)
):
    """Store user baseline profile answers JSON.
    Cannot be accidentally re-triggered if baseline already exists for the user (returns existing profile).
    Also creates a BaselineSnapshot record for longitudinal tracking.
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

    # Calculate normalized score
    norm_score = score_baseline_responses(payload.answers)
    now = utc_now()

    # Create new baseline profile
    profile = BaselineProfile(
        user_id=user_id,
        answers_json=payload.answers,
        created_at=now
    )
    db.add(profile)

    # Create BaselineSnapshot
    snapshot = BaselineSnapshot(
        user_id=user_id,
        version=ACTIVE_QUESTIONNAIRE_VERSION,
        scale_name="who5_adapted",
        score_normalized=norm_score,
        answers_json=payload.answers,
        created_at=now
    )
    db.add(snapshot)

    db.commit()
    db.refresh(profile)

    return BaselineResponse(
        user_id=profile.user_id,
        answers_json=profile.answers_json,
        created_at=profile.created_at,
        status="created"
    )

@router.post("/snapshot", response_model=BaselineSnapshotResponse, status_code=status.HTTP_201_CREATED)
def create_baseline_snapshot(
    payload: BaselineSnapshotCreate,
    db: Session = Depends(get_db)
):
    """Create periodic baseline snapshot (Day 14, 30, 60 recalibration)."""
    user_id = payload.user_id or "demo_user"
    ensure_user_exists(db, user_id)

    norm_score = score_baseline_responses(payload.answers)
    now = utc_now()

    snapshot = BaselineSnapshot(
        user_id=user_id,
        version=ACTIVE_QUESTIONNAIRE_VERSION,
        scale_name=payload.scale_name or "who5_adapted",
        score_normalized=norm_score,
        answers_json=payload.answers,
        created_at=now
    )
    db.add(snapshot)

    # Also update or set current baseline profile
    profile = db.query(BaselineProfile).filter(BaselineProfile.user_id == user_id).first()
    if profile:
        profile.answers_json = payload.answers
    else:
        profile = BaselineProfile(user_id=user_id, answers_json=payload.answers, created_at=now)
        db.add(profile)

    db.commit()
    db.refresh(snapshot)
    return snapshot

@router.get("/snapshots", response_model=List[BaselineSnapshotResponse])
def list_baseline_snapshots(
    user_id: str = Query("demo_user"),
    db: Session = Depends(get_db)
):
    """Fetch longitudinal history of baseline snapshots."""
    return (
        db.query(BaselineSnapshot)
        .filter(BaselineSnapshot.user_id == user_id)
        .order_by(BaselineSnapshot.created_at.desc())
        .all()
    )

@router.get("", response_model=BaselineResponse)
@router.get("/", response_model=BaselineResponse, include_in_schema=False)
def get_baseline(
    user_id: str = "demo_user",
    db: Session = Depends(get_db)
):
    """Fetch user's current baseline profile."""
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

