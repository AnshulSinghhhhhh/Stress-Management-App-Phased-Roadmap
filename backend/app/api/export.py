"""Router: User data export and deletion requests.
Per IMPLEMENTATION_PLAN.md §0.2, §0.3, and Phase 1.
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import (
    User, BaselineProfile, Checkin, DailyStressIndex,
    ReliefSession, WearableConnection, ConsentLog,
    DataExportRequest, DataDeletionRequest, CrisisEvent,
    utc_now
)
from app.schemas import (
    DataExportRequestModel, DataExportResponse,
    DataDeleteRequest, DataDeleteResponse
)

router = APIRouter(prefix="/data", tags=["Export & Deletion"])

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

@router.post("/export", response_model=DataExportResponse)
def export_user_data(
    payload: Optional[DataExportRequestModel] = None,
    db: Session = Depends(get_db)
):
    """Generate complete downloadable JSON of user data across tables."""
    user_id = (payload.user_id if payload else None) or "demo_user"
    user = ensure_user_exists(db, user_id)

    # 1. Baseline Profile
    baseline = db.query(BaselineProfile).filter(BaselineProfile.user_id == user_id).first()
    baseline_data = {
        "answers_json": baseline.answers_json,
        "created_at": baseline.created_at.isoformat()
    } if baseline else None

    # 2. Checkins
    checkins = db.query(Checkin).filter(Checkin.user_id == user_id).all()
    checkins_data = [
        {
            "id": c.id,
            "type": c.type,
            "mood_score": c.mood_score,
            "free_text": c.free_text,
            "emotional_tags": c.emotional_tags,
            "created_at": c.created_at.isoformat()
        }
        for c in checkins
    ]

    # 3. Daily Stress Index
    daily_scores = db.query(DailyStressIndex).filter(DailyStressIndex.user_id == user_id).all()
    daily_data = [
        {
            "date": d.date.isoformat(),
            "score": d.score,
            "computed_from": d.computed_from,
            "created_at": d.created_at.isoformat()
        }
        for d in daily_scores
    ]

    # 4. Relief Sessions
    sessions = db.query(ReliefSession).filter(ReliefSession.user_id == user_id).all()
    sessions_data = [
        {
            "id": s.id,
            "technique": s.technique,
            "checkin_id": s.checkin_id,
            "started_at": s.started_at.isoformat(),
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "self_reported_relief": s.self_reported_relief
        }
        for s in sessions
    ]

    # 5. Wearable Connections
    connections = db.query(WearableConnection).filter(WearableConnection.user_id == user_id).all()
    connections_data = [
        {
            "id": w.id,
            "provider": w.provider,
            "is_active": w.is_active,
            "connected_at": w.connected_at.isoformat(),
            "last_synced_at": w.last_synced_at.isoformat() if w.last_synced_at else None
        }
        for w in connections
    ]

    # 6. Consent Logs
    consent_logs = db.query(ConsentLog).filter(ConsentLog.user_id == user_id).all()
    consent_data = [
        {
            "id": cl.id,
            "consent_type": cl.consent_type,
            "version": cl.version,
            "granted_at": cl.granted_at.isoformat(),
            "revoked_at": cl.revoked_at.isoformat() if cl.revoked_at else None
        }
        for cl in consent_logs
    ]

    # 7. User metadata
    user_data = {
        "id": user.id,
        "email": user.email,
        "locale": user.locale,
        "consent_version_accepted": user.consent_version_accepted,
        "data_retention_pref": user.data_retention_pref,
        "created_at": user.created_at.isoformat()
    }

    now = utc_now()
    export_record = DataExportRequest(
        user_id=user_id,
        status="completed",
        requested_at=now,
        completed_at=now
    )
    db.add(export_record)
    db.commit()
    db.refresh(export_record)

    full_payload = {
        "user": user_data,
        "baseline_profile": baseline_data,
        "checkins": checkins_data,
        "stress_index_daily": daily_data,
        "relief_sessions": sessions_data,
        "wearable_connections": connections_data,
        "consent_log": consent_data
    }

    return DataExportResponse(
        export_id=export_record.id,
        status="completed",
        data=full_payload,
        requested_at=now
    )

@router.post("/delete", response_model=DataDeleteResponse)
def delete_user_data(
    payload: DataDeleteRequest,
    db: Session = Depends(get_db)
):
    """Irreversible deletion of user data across tables with confirm=True requirement."""
    if not payload.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Irreversible deletion requires confirm=True"
        )

    user_id = payload.user_id or "demo_user"
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found: {user_id}"
        )

    # Anonymize crisis events (strip user linkage while keeping safety log immutable)
    db.query(CrisisEvent).filter(CrisisEvent.user_id == user_id).update({"user_id": None})

    # Delete related tables
    db.query(BaselineProfile).filter(BaselineProfile.user_id == user_id).delete()
    db.query(Checkin).filter(Checkin.user_id == user_id).delete()
    db.query(DailyStressIndex).filter(DailyStressIndex.user_id == user_id).delete()
    db.query(ReliefSession).filter(ReliefSession.user_id == user_id).delete()
    db.query(WearableConnection).filter(WearableConnection.user_id == user_id).delete()
    db.query(ConsentLog).filter(ConsentLog.user_id == user_id).delete()
    db.query(DataExportRequest).filter(DataExportRequest.user_id == user_id).delete()
    db.query(DataDeletionRequest).filter(DataDeletionRequest.user_id == user_id).delete()

    # Finally delete the user record
    db.delete(user)
    db.commit()

    return DataDeleteResponse(
        status="deleted",
        message="All user data has been permanently deleted.",
        user_id=user_id
    )
