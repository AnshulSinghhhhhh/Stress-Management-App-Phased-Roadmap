import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta, time
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import (
    Checkin, DailyStressIndex, CrisisEvent, TriggerTag,
    CheckinFeaturesDerived, User, utc_now
)
from app.schemas import CheckinCreate, CheckinResponse, CheckinFeelingsUpdate, VALID_TRIGGER_CATEGORIES
from app.services.crisis_detector import crisis_detector
from app.services.stress_index import aggregate_daily_stress
from app.services.calibrated_stress import (
    compute_raw_stress_score, get_circadian_bucket
)
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/checkins", tags=["Checkins"])

IDEMPOTENCY_WINDOW_SECONDS = 5
PACING_WINDOW_MINUTES = 45

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

@router.get("/pacing/check")
def check_pacing_status(
    user_id: str = Query("demo_user"),
    db: Session = Depends(get_db)
):
    """Pacing check: returns soft branch advisory if user logged elevated stress recently.
    Per Step 6: Backend never blocks; this provides gentle UI guidance to prevent rumination.
    """
    now = utc_now()
    cutoff = now - timedelta(minutes=PACING_WINDOW_MINUTES)
    recent = (
        db.query(Checkin)
        .filter(Checkin.user_id == user_id, Checkin.created_at >= cutoff)
        .order_by(Checkin.created_at.desc())
        .first()
    )

    if not recent:
        return {"recent_checkin_exists": False, "soft_branch_recommended": False}

    recent_stress = compute_raw_stress_score(recent.mood_score, recent.emotional_tags)
    recent_created = recent.created_at
    if recent_created.tzinfo is None and now.tzinfo is not None:
        recent_created = recent_created.replace(tzinfo=timezone.utc)
    elif recent_created.tzinfo is not None and now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    minutes_ago = max(1, int((now - recent_created).total_seconds() / 60))

    soft_branch = (recent_stress >= 65.0)
    return {
        "recent_checkin_exists": True,
        "minutes_ago": minutes_ago,
        "recent_mood_score": recent.mood_score,
        "recent_stress_score": recent_stress,
        "soft_branch_recommended": soft_branch,
        "advisory_copy": (
            f"You checked in {minutes_ago} minute{'s' if minutes_ago > 1 else ''} ago. "
            "Your nervous system is still processing. Would you like to try a 2-minute grounding exercise instead, or note what shifted?"
        ) if soft_branch else None
    }

@router.post("", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_checkin(
    payload: CheckinCreate,
    db: Session = Depends(get_db)
):
    """Create a new check-in (open-label type).
    0. Evaluates idempotency: rejects identical submission from same user within window.
    1. Synchronously evaluates crisis patterns in free_text (<50ms).
    2. If crisis detected, immediately creates an immutable CrisisEvent.
    3. Persists check-in with idempotency_key, metadata, and embedding.
    4. Auto-classifies trigger taxonomy if free_text is present.
    5. Stores derived feature record in checkin_features_derived.
    6. Recalculates today's daily stress score and upserts stress_index_daily.
    7. Returns check-in with crisis_response, daily_stress_score, and derived_stress_score.
    """
    user_id = payload.user_id or "demo_user"
    ensure_user_exists(db, user_id)

    # 0. Idempotency safeguard: check explicit idempotency_key if supplied
    if payload.idempotency_key:
        existing_by_key = (
            db.query(Checkin)
            .filter(
                Checkin.user_id == user_id,
                Checkin.idempotency_key == payload.idempotency_key
            )
            .first()
        )
        if existing_by_key:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate check-in detected. An identical check-in was recently submitted.",
            )

    # Reject identical submission from same user within 5s window
    now = utc_now()
    cutoff = now - timedelta(seconds=IDEMPOTENCY_WINDOW_SECONDS)
    recent_checkins = (
        db.query(Checkin)
        .filter(
            Checkin.user_id == user_id,
            Checkin.created_at >= cutoff
        )
        .order_by(Checkin.created_at.desc())
        .all()
    )

    req_text = (payload.free_text or "").strip()
    req_tags = sorted(payload.emotional_tags or [])

    for existing in recent_checkins:
        exist_text = (existing.free_text or "").strip()
        exist_tags = sorted(existing.emotional_tags or [])
        if (
            existing.type == payload.type
            and existing.mood_score == payload.mood_score
            and exist_text == req_text
            and exist_tags == req_tags
        ):
            logger.warning(
                "Duplicate check-in rejected for user %s (idempotency window: %ss)",
                user_id,
                IDEMPOTENCY_WINDOW_SECONDS,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate check-in detected. An identical check-in was recently submitted.",
            )

    # 1. Synchronous crisis check (<50ms) — NEVER MODIFIED per SOP §6
    crisis_response = None
    crisis_result = crisis_detector.check_crisis(payload.free_text)
    if crisis_result.get("crisis_detected"):
        crisis_response = crisis_result
        # SAFETY CRITICAL: Append-only log to crisis_events
        crisis_event = CrisisEvent(
            user_id=user_id,
            triggered_by=crisis_result.get("triggered_by") or "keyword_checkin",
            detector_version=crisis_result.get("detector_version", "1.0.0"),
            resources_shown_json=crisis_result.get("resources", []),
            timestamp=utc_now()
        )
        db.add(crisis_event)
        db.commit()

    # 2. Compute embedding for free_text (Phase 2 §2.0)
    embedding = None
    if payload.free_text and payload.free_text.strip():
        try:
            from app.services.trigger_classifier import compute_embedding
            embedding = compute_embedding(payload.free_text)
        except Exception as e:
            logger.warning("Embedding computation failed (non-blocking): %s", e)

    # 3. Persist check-in with v2 metadata
    now = utc_now()
    checkin_key = payload.idempotency_key or str(uuid.uuid4())
    bucket = get_circadian_bucket(now, payload.user_tz_offset_minutes or 0)
    derived_score = compute_raw_stress_score(payload.mood_score, payload.emotional_tags)

    checkin = Checkin(
        user_id=user_id,
        idempotency_key=checkin_key,
        type=payload.type,
        mood_score=payload.mood_score,
        free_text=payload.free_text,
        emotional_tags=payload.emotional_tags or [],
        embedding=embedding,
        embedding_model_version="all-MiniLM-L6-v2-v1",
        questionnaire_version="2.0.0",
        scale_version="2.0.0",
        user_tz_offset_minutes=payload.user_tz_offset_minutes or 0,
        created_at=now
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    # 3b. Persist CheckinFeaturesDerived
    features = CheckinFeaturesDerived(
        checkin_id=checkin.id,
        user_id=user_id,
        derived_stress_score=derived_score,
        circadian_bucket=bucket,
        confidence=1.0,
        model_version="calibrated_v2",
        created_at=now
    )
    db.add(features)
    db.commit()


    # 4. Auto-classify trigger taxonomy or persist user-selected trigger tag (Phase 2 §2.0)
    # Per guardrail: this must NEVER fail or block the check-in response.
    user_cats = []
    if payload.trigger_category and payload.trigger_category in VALID_TRIGGER_CATEGORIES:
        user_cats.append(payload.trigger_category)
    if payload.trigger_categories:
        for c in payload.trigger_categories:
            if c in VALID_TRIGGER_CATEGORIES and c not in user_cats:
                user_cats.append(c)

    tag = None
    if user_cats:
        for cat in user_cats:
            t = TriggerTag(
                checkin_id=checkin.id,
                user_id=user_id,
                category=cat,
                confidence=1.0,
                source="user_corrected",
                created_at=now,
            )
            db.add(t)
            if tag is None:
                tag = t
        db.commit()

        # Per §2.0: user corrections are appended to few-shot examples
        if payload.free_text and payload.free_text.strip():
            try:
                from app.services.trigger_classifier import append_user_example
                for cat in user_cats:
                    append_user_example(cat, payload.free_text)
            except Exception as e:
                logger.warning("Failed to append user example (non-blocking): %s", e)
    elif payload.free_text and payload.free_text.strip():
        try:
            from app.services.trigger_classifier import classify_trigger
            result = classify_trigger(
                text=payload.free_text,
                embedding=embedding,
                nim_api_key=settings.NVIDIA_API_KEY,
                nim_base_url=settings.NVIDIA_BASE_URL,
                nim_model=settings.NVIDIA_MODEL,
            )
            tag = TriggerTag(
                checkin_id=checkin.id,
                user_id=user_id,
                category=result["category"],
                confidence=result["confidence"],
                source=result["source"],
                created_at=now,
            )
            db.add(tag)
            db.commit()
        except Exception as e:
            logger.warning("Trigger classification failed (non-blocking): %s", e)

    # 5. Deeper CBT probing question on 3+ recurrence (Phase 2 §2.0)
    # When category recurs 3+ times in rolling 14-day window:
    # Retrieve user's 2-3 most similar past check-ins (user-scoped only),
    # and call NIM with past phrasing to generate one reflective question.
    # Fail-open guardrail: skip if NIM fails or times out.
    probing_question = None
    if tag and payload.free_text and payload.free_text.strip() and embedding:
        try:
            from app.services.probing import maybe_generate_probing_question
            probing_question = maybe_generate_probing_question(
                db=db,
                user_id=user_id,
                current_checkin_id=checkin.id,
                current_text=payload.free_text,
                category=tag.category,
                target_embedding=embedding,
                min_recurrence=3,
                window_days=14,
            )
        except Exception as e:
            logger.warning("Deeper probing generation failed (fail-open): %s", e)
            probing_question = None

    # 5b. Feeling tone detection from free_text (v2.2 Objective 2)
    # Scope: TEXT ONLY (transcribed voice or typed). Fail-safe, non-blocking, zero impact on stress formula.
    detected_feelings = []
    detected_feelings_confidence = None
    detected_feelings_source = None
    if payload.free_text and payload.free_text.strip():
        try:
            from app.services.feeling_classifier import classify_feelings
            feelings_res = classify_feelings(
                text=payload.free_text,
                embedding=embedding,
                nim_api_key=settings.NVIDIA_API_KEY,
                nim_base_url=settings.NVIDIA_BASE_URL,
                nim_model=settings.NVIDIA_MODEL,
            )
            detected_feelings = feelings_res.get("detected_feelings", [])
            detected_feelings_confidence = feelings_res.get("confidence")
            detected_feelings_source = feelings_res.get("source")
        except Exception as e:
            logger.warning("Feeling classification failed (non-blocking): %s", e)

    # 6. Recalculate daily stress index for today
    today_date = now.date()
    start_of_day = datetime(today_date.year, today_date.month, today_date.day, 0, 0, 0, tzinfo=timezone.utc)
    end_of_day = datetime(today_date.year, today_date.month, today_date.day, 23, 59, 59, 999999, tzinfo=timezone.utc)

    todays_checkins = db.query(Checkin).filter(
        Checkin.user_id == user_id,
        Checkin.created_at >= start_of_day,
        Checkin.created_at <= end_of_day
    ).all()

    contributing = [
        {
            "id": c.id,
            "mood_score": c.mood_score,
            "type": c.type,
            "created_at": c.created_at.isoformat()
        }
        for c in todays_checkins
    ]

    daily_score = aggregate_daily_stress(contributing)

    # Upsert DailyStressIndex
    daily_index = db.query(DailyStressIndex).filter(
        DailyStressIndex.user_id == user_id,
        DailyStressIndex.date == today_date
    ).first()

    if daily_index:
        daily_index.score = daily_score
        daily_index.computed_from = contributing
    else:
        daily_index = DailyStressIndex(
            user_id=user_id,
            date=today_date,
            score=daily_score,
            computed_from=contributing,
            created_at=now
        )
        db.add(daily_index)

    db.commit()

    return CheckinResponse(
        id=checkin.id,
        user_id=checkin.user_id,
        idempotency_key=checkin.idempotency_key,
        type=checkin.type,
        mood_score=checkin.mood_score,
        free_text=checkin.free_text,
        emotional_tags=checkin.emotional_tags,
        created_at=checkin.created_at,
        crisis_response=crisis_response,
        daily_stress_score=daily_score,
        derived_stress_score=derived_score,
        confidence=1.0,
        circadian_bucket=bucket,
        probing_question=probing_question,
        detected_feelings=detected_feelings,
        detected_feelings_confidence=detected_feelings_confidence,
        detected_feelings_source=detected_feelings_source,
        trigger_categories=user_cats,
    )

@router.patch("/{checkin_id}/feelings", response_model=CheckinResponse)
def update_checkin_feelings(
    checkin_id: str,
    payload: CheckinFeelingsUpdate,
    user_id: str = "demo_user",
    db: Session = Depends(get_db)
):
    """Accept or update detected feelings for a checkin. Adds to emotional_tags without altering calibrated stress calculation formula."""
    chk = db.query(Checkin).filter(Checkin.id == checkin_id, Checkin.user_id == user_id).first()
    if not chk:
        raise HTTPException(status_code=404, detail="Checkin not found")

    current_tags = list(chk.emotional_tags or [])
    for f in payload.feelings:
        if f not in current_tags:
            current_tags.append(f)
    chk.emotional_tags = current_tags
    db.commit()
    db.refresh(chk)
    return chk

@router.get("/today", response_model=List[CheckinResponse])
def get_todays_checkins(
    user_id: str = "demo_user",
    db: Session = Depends(get_db)
):
    """Fetch today's check-ins for the user preserving diurnal sequence."""
    now = utc_now()
    today_date = now.date()
    start_of_day = datetime(today_date.year, today_date.month, today_date.day, 0, 0, 0, tzinfo=timezone.utc)
    end_of_day = datetime(today_date.year, today_date.month, today_date.day, 23, 59, 59, 999999, tzinfo=timezone.utc)

    return (
        db.query(Checkin)
        .filter(
            Checkin.user_id == user_id,
            Checkin.created_at >= start_of_day,
            Checkin.created_at <= end_of_day
        )
        .order_by(Checkin.created_at.asc())
        .all()
    )

@router.get("/history", response_model=List[CheckinResponse])
@router.get("", response_model=List[CheckinResponse])
@router.get("/", response_model=List[CheckinResponse], include_in_schema=False)
def list_checkins(
    user_id: str = "demo_user",
    limit: int = Query(50, ge=1, le=500),
    range: Optional[str] = Query(None, description="'7d', '30d', or null for all"),
    type: Optional[str] = Query(None, description="Filter by open label e.g. 'morning', 'evening', 'manual'"),
    db: Session = Depends(get_db)
):
    """List check-ins for user, ordered newest first."""
    query = db.query(Checkin).filter(Checkin.user_id == user_id)

    if range:
        now = utc_now()
        if range == "7d":
            query = query.filter(Checkin.created_at >= now - timedelta(days=7))
        elif range == "30d":
            query = query.filter(Checkin.created_at >= now - timedelta(days=30))

    if type:
        query = query.filter(Checkin.type == type)

    checkins = query.order_by(Checkin.created_at.desc()).limit(limit).all()
    return checkins

