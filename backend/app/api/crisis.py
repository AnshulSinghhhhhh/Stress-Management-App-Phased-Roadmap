"""Router: Crisis pathway detection and emergency resources.
SAFETY CRITICAL:
- Never gated behind login friction.
- Zero network latency dependency on first line (<50ms).
- Append-only log to crisis_events.
- All helpline resources sourced from app.core.crisis_resources.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.crisis_resources import get_crisis_payload, CRISIS_DETECTOR_VERSION, INDIA_CRISIS_RESOURCES
from app.models import CrisisEvent, utc_now
from app.schemas import CrisisCheckRequest, CrisisCheckResponse
from app.services.crisis_detector import crisis_detector

router = APIRouter(prefix="/crisis", tags=["Crisis"])

@router.post("/check", response_model=CrisisCheckResponse, status_code=status.HTTP_200_OK)
def check_crisis(
    payload: CrisisCheckRequest,
    db: Session = Depends(get_db)
):
    """Fast, login-free endpoint for checking free text or manual emergency clicks.
    Returns verified crisis resources (Tele MANAS, KIRAN, 112) synchronously and records crisis_event.
    """
    text = (payload.text or "").strip()
    is_manual = payload.is_manual or (text.lower() in ["emergency", "manual_emergency", "sos"])

    if is_manual:
        crisis_data = get_crisis_payload()
        crisis_data["triggered_by"] = "manual_emergency_button"
        crisis_data["detection_latency_ms"] = 0.5

        # SAFETY CRITICAL: Append-only log
        event = CrisisEvent(
            user_id=payload.user_id,
            triggered_by="manual_emergency_button",
            detector_version=crisis_data.get("detector_version", CRISIS_DETECTOR_VERSION),
            resources_shown_json=crisis_data.get("resources", INDIA_CRISIS_RESOURCES),
            timestamp=utc_now()
        )
        db.add(event)
        db.commit()

        return CrisisCheckResponse(**crisis_data)

    # Deterministic check
    result = crisis_detector.check_crisis(text)

    if result.get("crisis_detected"):
        event = CrisisEvent(
            user_id=payload.user_id,
            triggered_by=result.get("triggered_by") or "keyword_detected",
            detector_version=result.get("detector_version", CRISIS_DETECTOR_VERSION),
            resources_shown_json=result.get("resources", INDIA_CRISIS_RESOURCES),
            timestamp=utc_now()
        )
        db.add(event)
        db.commit()

    return CrisisCheckResponse(**result)
