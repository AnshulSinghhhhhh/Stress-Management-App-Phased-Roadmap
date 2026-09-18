"""Router: Daily checkins (morning, evening, manual) and stress evaluation.
Phase 2 §2.0: Automatically computes embedding and trigger tags on each check-in.
"""
from typing import Optional, List
from datetime import datetime, timezone, timedelta, time
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Checkin, DailyStressIndex, CrisisEvent, TriggerTag, User, utc_now
from app.schemas import CheckinCreate, CheckinResponse, VALID_TRIGGER_CATEGORIES
from app.services.crisis_detector import crisis_detector
from app.services.stress_index import aggregate_daily_stress
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/checkins", tags=["Checkins"])

IDEMPOTENCY_WINDOW_SECONDS = 5

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

@router.post("", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_checkin(
    payload: CheckinCreate,
    db: Session = Depends(get_db)
):
    """Create a new check-in (morning, evening, or manual).
    0. Evaluates idempotency: rejects identical submission from same user within window.
    1. Synchronously evaluates crisis patterns in free_text (<50ms).
    2. If crisis detected, immediately creates an immutable CrisisEvent.
    3. Persists check-in with embedding (Phase 2 §2.0).
    4. Auto-classifies trigger taxonomy if free_text is present.
    5. Recalculates today's daily stress score and upserts stress_index_daily.
    6. Returns check-in with optional crisis_response and daily_stress_score.
    """
    user_id = payload.user_id or "demo_user"
    ensure_user_exists(db, user_id)

    # 0. Idempotency safeguard: reject identical submission from same user within window
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
    # One embedding serves both trigger classification AND pgvector RAG retrieval.
    embedding = None
    if payload.free_text and payload.free_text.strip():
        try:
            from app.services.trigger_classifier import compute_embedding
            embedding = compute_embedding(payload.free_text)
        except Exception as e:
            logger.warning("Embedding computation failed (non-blocking): %s", e)

    # 3. Persist check-in
    now = utc_now()
    checkin = Checkin(
        user_id=user_id,
        type=payload.type,
        mood_score=payload.mood_score,
        free_text=payload.free_text,
        emotional_tags=payload.emotional_tags or [],
        embedding=embedding,
        created_at=now
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

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
        type=checkin.type,
        mood_score=checkin.mood_score,
        free_text=checkin.free_text,
        emotional_tags=checkin.emotional_tags,
        created_at=checkin.created_at,
        crisis_response=crisis_response,
        daily_stress_score=daily_score,
        probing_question=probing_question
    )

@router.get("", response_model=List[CheckinResponse])
@router.get("/", response_model=List[CheckinResponse], include_in_schema=False)
def list_checkins(
    user_id: str = "demo_user",
    limit: int = Query(50, ge=1, le=500),
    range: Optional[str] = Query(None, description="'7d', '30d', or null for all"),
    type: Optional[str] = Query(None, description="Filter by 'morning', 'evening', or 'manual'"),
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
