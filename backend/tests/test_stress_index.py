"""Tests for Daily Stress Index History and Trend Line API (IMPLEMENTATION_PLAN.md §0.2 and Phase 1)."""
from datetime import datetime, timezone, timedelta, date
import pytest
from app.models import DailyStressIndex

def test_get_stress_index_history(client, db_session):
    user_id = "test_user_stress_trend"
    today = datetime.now(timezone.utc).date()

    # Seed 3 daily stress index entries across days
    d1 = today - timedelta(days=5)
    d2 = today - timedelta(days=2)
    d3 = today

    db_session.add_all([
        DailyStressIndex(user_id=user_id, date=d1, score=65.5, computed_from=[{"mood_score": 4}]),
        DailyStressIndex(user_id=user_id, date=d2, score=40.0, computed_from=[{"mood_score": 6}, {"mood_score": 7}]),
        DailyStressIndex(user_id=user_id, date=d3, score=25.0, computed_from=[{"mood_score": 8}])
    ])
    db_session.commit()

    # Query 7-day trend
    res_7d = client.get(f"/stress-index?user_id={user_id}&range=7d")
    assert res_7d.status_code == 200
    points = res_7d.json()
    assert len(points) == 3

    # Check ascending order and data schema
    assert points[0]["date"] == d1.isoformat()
    assert points[0]["score"] == 65.5
    assert points[0]["computed_from_count"] == 1

    assert points[1]["date"] == d2.isoformat()
    assert points[1]["score"] == 40.0
    assert points[1]["computed_from_count"] == 2

    assert points[2]["date"] == d3.isoformat()
    assert points[2]["score"] == 25.0
    assert points[2]["computed_from_count"] == 1

def test_stress_index_range_filter(client, db_session):
    user_id = "test_user_stress_range"
    today = datetime.now(timezone.utc).date()

    # Add entry 15 days ago and today
    d_old = today - timedelta(days=15)
    d_now = today

    db_session.add_all([
        DailyStressIndex(user_id=user_id, date=d_old, score=80.0, computed_from=[]),
        DailyStressIndex(user_id=user_id, date=d_now, score=30.0, computed_from=[])
    ])
    db_session.commit()

    # 7-day range should NOT include 15-day-old entry
    res_7d = client.get(f"/api/v1/stress-index?user_id={user_id}&range=7d")
    assert res_7d.status_code == 200
    assert len(res_7d.json()) == 1
    assert res_7d.json()[0]["date"] == d_now.isoformat()

    # 30-day range should include both
    res_30d = client.get(f"/api/v1/stress-index?user_id={user_id}&range=30d")
    assert res_30d.status_code == 200
    assert len(res_30d.json()) == 2
