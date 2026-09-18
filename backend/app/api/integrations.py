"""Router: Wearable mock integrations (Fitbit, Apple Health, Google Fit).
Per IMPLEMENTATION_PLAN.md Phase 1: App must remain fully functional with zero wearables connected.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import WearableConnection, User, utc_now
from app.schemas import (
    WearableConnectRequest, WearableConnectionResponse,
    WearableStatusResponse
)

router = APIRouter(prefix="/integrations/wearable", tags=["Wearable Integrations"])

VALID_PROVIDERS = {"fitbit", "apple_health", "google_fit"}

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

@router.post("/connect", response_model=WearableConnectionResponse, status_code=status.HTTP_200_OK)
def connect_wearable(
    payload: WearableConnectRequest,
    db: Session = Depends(get_db)
):
    """Mock wearable connection for Fitbit, Apple Health, or Google Fit.
    App remains 100% functional with or without wearables connected.
    """
    provider = payload.provider.lower().strip()
    if provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider '{provider}'. Must be one of: {', '.join(VALID_PROVIDERS)}"
        )

    user_id = payload.user_id or "demo_user"
    ensure_user_exists(db, user_id)

    now = utc_now()
    connection = db.query(WearableConnection).filter(
        WearableConnection.user_id == user_id,
        WearableConnection.provider == provider
    ).first()

    if connection:
        connection.is_active = True
        connection.last_synced_at = now
    else:
        connection = WearableConnection(
            user_id=user_id,
            provider=provider,
            connected_at=now,
            last_synced_at=now,
            is_active=True
        )
        db.add(connection)

    db.commit()
    db.refresh(connection)

    return connection

@router.get("/status", response_model=WearableStatusResponse)
def get_wearable_status(
    user_id: str = Query("demo_user", description="User ID"),
    db: Session = Depends(get_db)
):
    """Get wearable connection status for user."""
    connections = db.query(WearableConnection).filter(
        WearableConnection.user_id == user_id
    ).all()

    has_active = any(c.is_active for c in connections)

    return WearableStatusResponse(
        user_id=user_id,
        connected=has_active,
        connections=connections
    )
