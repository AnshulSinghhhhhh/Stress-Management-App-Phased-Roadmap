"""Router: Trigger taxonomy classification (Phase 2 §2.0).
GET /triggers — list trigger tags for a user, optionally filtered by date range.
POST /triggers — manually correct / add a trigger tag for a checkin.
"""
from typing import List, Optional
from datetime import timedelta
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models import TriggerTag, Checkin, utc_now
from app.schemas import TriggerTagResponse, TriggerTagCorrection, TriggerSummary, VALID_TRIGGER_CATEGORIES
from app.services.trigger_classifier import append_user_example

router = APIRouter(prefix="/triggers", tags=["Trigger Taxonomy"])


@router.get("", response_model=List[TriggerTagResponse])
@router.get("/", response_model=List[TriggerTagResponse], include_in_schema=False)
def list_trigger_tags(
    user_id: str = Query("demo_user"),
    range: Optional[str] = Query(None, description="'7d', '14d', '30d'"),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List trigger tags for a user with optional filters."""
    query = db.query(TriggerTag).filter(TriggerTag.user_id == user_id)

    if range:
        now = utc_now()
        days = {"7d": 7, "14d": 14, "30d": 30}.get(range, 14)
        query = query.filter(TriggerTag.created_at >= now - timedelta(days=days))

    if category and category in VALID_TRIGGER_CATEGORIES:
        query = query.filter(TriggerTag.category == category)

    return query.order_by(TriggerTag.created_at.desc()).limit(200).all()


@router.get("/summary", response_model=List[TriggerSummary])
def trigger_summary(
    user_id: str = Query("demo_user"),
    range: str = Query("14d", description="'7d', '14d', '30d'"),
    db: Session = Depends(get_db),
):
    """Aggregated trigger counts by category for the root-cause dashboard."""
    days = {"7d": 7, "14d": 14, "30d": 30}.get(range, 14)
    cutoff = utc_now() - timedelta(days=days)

    rows = (
        db.query(
            TriggerTag.category,
            func.count(TriggerTag.id).label("count"),
            func.avg(TriggerTag.confidence).label("avg_confidence"),
        )
        .filter(TriggerTag.user_id == user_id, TriggerTag.created_at >= cutoff)
        .group_by(TriggerTag.category)
        .order_by(func.count(TriggerTag.id).desc())
        .all()
    )

    results = []
    for row in rows:
        # Get distinct sources for this category
        sources = (
            db.query(TriggerTag.source)
            .filter(
                TriggerTag.user_id == user_id,
                TriggerTag.category == row.category,
                TriggerTag.created_at >= cutoff,
            )
            .distinct()
            .all()
        )
        results.append(TriggerSummary(
            category=row.category,
            count=row.count,
            avg_confidence=round(float(row.avg_confidence), 4),
            sources=[s[0] for s in sources],
        ))

    return results


@router.post("/{checkin_id}/correct", response_model=TriggerTagResponse)
def correct_trigger_tag(
    checkin_id: str,
    correction: TriggerTagCorrection,
    user_id: str = Query("demo_user"),
    db: Session = Depends(get_db),
):
    """User correction of a trigger tag. Per §2.0: user corrections are
    appended to the few-shot example set, improving accuracy over time.
    """
    if correction.category not in VALID_TRIGGER_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category '{correction.category}'. Must be one of: {VALID_TRIGGER_CATEGORIES}",
        )

    checkin = db.query(Checkin).filter(Checkin.id == checkin_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")

    # Create user-corrected tag
    tag = TriggerTag(
        checkin_id=checkin_id,
        user_id=user_id,
        category=correction.category,
        confidence=1.0,
        source="user_corrected",
        created_at=utc_now(),
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)

    # Append to few-shot examples for future classifications
    if checkin.free_text:
        append_user_example(correction.category, checkin.free_text)

    return tag
