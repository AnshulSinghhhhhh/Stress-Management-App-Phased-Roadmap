"""Router: Daily stress index score trends."""
from typing import List, Optional
from datetime import timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import DailyStressIndex, utc_now
from app.schemas import DailyStressPoint

router = APIRouter(prefix="/stress-index", tags=["Stress Index"])

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
