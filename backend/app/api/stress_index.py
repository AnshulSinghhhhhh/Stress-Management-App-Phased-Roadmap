"""Router: Calibrated stress indicators, longitudinal trends, and personalized root-cause insights."""
from typing import List, Optional, Dict, Any
from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import DailyStressIndex, Checkin, utc_now
from app.schemas import (
    DailyStressPoint,
    CalibratedStressIndicatorResponse,
    LongitudinalTrendResponse,
    LongitudinalTrendPoint,
    ContributingFactor
)
from app.services.calibrated_stress import (
    compute_calibrated_metrics_for_user,
    compute_raw_stress_score
)

router = APIRouter(prefix="/stress-index", tags=["Stress Index"])

@router.get("/indicators/current", response_model=CalibratedStressIndicatorResponse)
def get_current_calibrated_indicator(
    user_id: str = Query("demo_user", description="User ID"),
    window_days: int = Query(14, ge=1, le=60),
    db: Session = Depends(get_db)
):
    """Fetch current calibrated stress status, confidence score, effective sample size,
    and deterministic contributing factors.
    """
    metrics = compute_calibrated_metrics_for_user(db, user_id=user_id, window_days=window_days)
    return CalibratedStressIndicatorResponse(**metrics)

@router.get("/trends", response_model=LongitudinalTrendResponse)
def get_longitudinal_trends(
    user_id: str = Query("demo_user", description="User ID"),
    range_param: str = Query("7d", alias="range", description="'7d' or '30d'"),
    db: Session = Depends(get_db)
):
    """Fetch longitudinal daily trend points with honest minimum-N gating.
    Eliminates synthetic sine-wave hallucinations and surfaces calibration status.
    """
    days = 30 if range_param == "30d" else 7
    metrics = compute_calibrated_metrics_for_user(db, user_id=user_id, window_days=days)

    cutoff = utc_now() - timedelta(days=days)
    checkins = (
        db.query(Checkin)
        .filter(Checkin.user_id == user_id, Checkin.created_at >= cutoff)
        .order_by(Checkin.created_at.asc())
        .all()
    )

    # Group daily
    daily_map: Dict[Any, List[float]] = {}
    for c in checkins:
        ld = (c.created_at + timedelta(minutes=c.user_tz_offset_minutes or 0)).date()
        daily_map.setdefault(ld, []).append(compute_raw_stress_score(c.mood_score, c.emotional_tags))

    today = utc_now().date()
    points: List[LongitudinalTrendPoint] = []

    for i in range(days - 1, -1, -1):
        target_date = today - timedelta(days=i)
        day_scores = daily_map.get(target_date, [])
        if day_scores:
            avg_score = round(sum(day_scores) / len(day_scores), 1)
            cnt = len(day_scores)
        else:
            avg_score = 0.0
            cnt = 0

        day_label = target_date.strftime("%a")
        points.append(LongitudinalTrendPoint(
            date=target_date,
            score=avg_score,
            confidence=metrics["confidence_score"] if cnt > 0 else 0.0,
            checkin_count=cnt,
            label=day_label
        ))

    return LongitudinalTrendResponse(
        user_id=user_id,
        range=range_param,
        status=metrics["status"],
        minimum_n_met=metrics["minimum_n_met"],
        distinct_days=metrics["distinct_days"],
        points=points
    )

@router.get("/insights/personalized", response_model=List[ContributingFactor])
def get_personalized_insights(
    user_id: str = Query("demo_user", description="User ID"),
    window_days: int = Query(14, ge=7, le=60),
    db: Session = Depends(get_db)
):
    """Fetch deterministic contributing factors for root cause analysis."""
    metrics = compute_calibrated_metrics_for_user(db, user_id=user_id, window_days=window_days)
    return metrics["contributing_factors"]

@router.get("", response_model=List[DailyStressPoint])
@router.get("/", response_model=List[DailyStressPoint], include_in_schema=False)
def get_stress_index_history(
    user_id: str = Query("demo_user", description="User ID"),
    range: str = Query("7d", description="'7d' or '30d' or 'all'"),
    db: Session = Depends(get_db)
):
    """Return daily stress scores for last 7/30 days (date, score, computed_from count)."""
    query = db.query(DailyStressIndex).filter(DailyStressIndex.user_id == user_id)

    today = utc_now().date()
    if range == "7d":
        query = query.filter(DailyStressIndex.date >= today - timedelta(days=7))
    elif range == "30d":
        query = query.filter(DailyStressIndex.date >= today - timedelta(days=30))

    records = query.order_by(DailyStressIndex.date.asc()).all()

    return [
        DailyStressPoint(
            date=r.date,
            score=r.score,
            computed_from_count=len(r.computed_from) if isinstance(r.computed_from, list) else 0,
            computed_from=r.computed_from
        )
        for r in records
    ]

