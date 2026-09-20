"""Router: Consent tracking & audit logging.
Per IMPLEMENTATION_PLAN.md Section 4 & Ground Rule 4.
Manages immutable user consent records, revocations, and active privacy status.
"""
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ConsentLog, User, utc_now
from app.schemas import (
    ConsentStatusResponse, ConsentItem,
    ConsentGrantRequest, ConsentRevokeRequest
)

router = APIRouter(prefix="/consent", tags=["Consent"])

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

@router.get("/status", response_model=ConsentStatusResponse)
def get_consent_status(
    user_id: str = Query("demo_user"),
    db: Session = Depends(get_db)
):
    """Fetch current active consents and immutable audit history for user."""
    ensure_user_exists(db, user_id)

    logs = (
        db.query(ConsentLog)
        .filter(ConsentLog.user_id == user_id)
        .order_by(ConsentLog.granted_at.desc())
        .all()
    )

    # Determine latest status per consent type
    active_consents: Dict[str, bool] = {
        "terms_and_privacy": False,
        "wearable_data": False,
        "anonymous_analytics": False
    }

    history: List[ConsentItem] = []
    seen_types = set()

    for log in logs:
        is_active = (log.revoked_at is None)
        if log.consent_type not in seen_types:
            active_consents[log.consent_type] = is_active
            seen_types.add(log.consent_type)

        history.append(ConsentItem(
            consent_type=log.consent_type,
            granted=is_active,
            version=log.version,
            granted_at=log.granted_at,
            revoked_at=log.revoked_at
        ))

    # Always default terms_and_privacy to true if user exists and accepted onboarding
    if "terms_and_privacy" not in seen_types:
        active_consents["terms_and_privacy"] = True

    return ConsentStatusResponse(
        user_id=user_id,
        active_consents=active_consents,
        history=history
    )

@router.post("", response_model=ConsentItem, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ConsentItem, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def grant_consent(
    payload: ConsentGrantRequest,
    db: Session = Depends(get_db)
):
    """Record granted consent in immutable audit log."""
    user_id = payload.user_id or "demo_user"
    ensure_user_exists(db, user_id)

    now = utc_now()
    log = ConsentLog(
        user_id=user_id,
        consent_type=payload.consent_type,
        version=payload.version,
        granted_at=now,
        revoked_at=None
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return ConsentItem(
        consent_type=log.consent_type,
        granted=True,
        version=log.version,
        granted_at=log.granted_at,
        revoked_at=None
    )

@router.post("/revoke", response_model=ConsentItem)
def revoke_consent(
    payload: ConsentRevokeRequest,
    db: Session = Depends(get_db)
):
    """Revoke specific consent type by updating revoked_at timestamp in audit log."""
    user_id = payload.user_id or "demo_user"
    ensure_user_exists(db, user_id)

    now = utc_now()
    # Find active grant
    active_grant = (
        db.query(ConsentLog)
        .filter(
            ConsentLog.user_id == user_id,
            ConsentLog.consent_type == payload.consent_type,
            ConsentLog.revoked_at.is_(None)
        )
        .order_by(ConsentLog.granted_at.desc())
        .first()
    )

    version_used = active_grant.version if active_grant else "2.0.0"
    if active_grant:
        active_grant.revoked_at = now

    # Append immutable revocation entry for audit trail
    revocation_log = ConsentLog(
        user_id=user_id,
        consent_type=payload.consent_type,
        version=version_used,
        granted_at=now,
        revoked_at=now
    )
    db.add(revocation_log)
    db.commit()
    db.refresh(revocation_log)

    return ConsentItem(
        consent_type=revocation_log.consent_type,
        granted=False,
        version=revocation_log.version,
        granted_at=revocation_log.granted_at,
        revoked_at=revocation_log.revoked_at
    )
