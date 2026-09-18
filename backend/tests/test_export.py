"""Tests for User Data Export and Deletion API (IMPLEMENTATION_PLAN.md §0.2, §0.3, and Phase 1)."""
from datetime import datetime, timezone
import pytest
from app.models import (
    User, BaselineProfile, Checkin, DailyStressIndex,
    ReliefSession, WearableConnection, ConsentLog, CrisisEvent
)

def test_export_complete_user_data(client, db_session):
    user_id = "test_user_export_full"
    today = datetime.now(timezone.utc).date()

    # Seed all user-related tables
    user = User(id=user_id, email="export_test@example.com", locale="en", consent_version_accepted="1.0.0", data_retention_pref="standard")
    db_session.add(user)
    db_session.commit()

    db_session.add_all([
        BaselineProfile(user_id=user_id, answers_json={"goals": "reduce stress"}),
        Checkin(user_id=user_id, type="morning", mood_score=7, free_text="feeling good", emotional_tags=["optimistic"]),
        DailyStressIndex(user_id=user_id, date=today, score=33.33, computed_from=[{"mood_score": 7}]),
        ReliefSession(user_id=user_id, technique="square_breathing", self_reported_relief=4),
        WearableConnection(user_id=user_id, provider="fitbit", is_active=True),
        ConsentLog(user_id=user_id, consent_type="terms_and_privacy", version="1.0.0")
    ])
    db_session.commit()

    # Call export endpoint
    res = client.post("/data/export", json={"user_id": user_id})
    assert res.status_code == 200
    export_payload = res.json()

    assert export_payload["status"] == "completed"
    assert export_payload["export_id"] is not None
    data = export_payload["data"]

    # Verify all expected sections are populated
    assert data["user"]["id"] == user_id
    assert data["user"]["email"] == "export_test@example.com"
    assert data["baseline_profile"]["answers_json"]["goals"] == "reduce stress"
    assert len(data["checkins"]) == 1
    assert data["checkins"][0]["mood_score"] == 7
    assert len(data["stress_index_daily"]) == 1
    assert len(data["relief_sessions"]) == 1
    assert data["relief_sessions"][0]["technique"] == "square_breathing"
    assert len(data["wearable_connections"]) == 1
    assert data["wearable_connections"][0]["provider"] == "fitbit"
    assert len(data["consent_log"]) == 1

def test_delete_user_data_requires_confirmation(client):
    # Missing confirm=True should be rejected
    res = client.post("/data/delete", json={"user_id": "demo_user", "confirm": False})
    assert res.status_code == 400
    assert "confirm=true" in res.json()["detail"].lower()

def test_delete_user_data_irreversible(client, db_session):
    user_id = "test_user_to_delete"
    today = datetime.now(timezone.utc).date()

    # Seed data for this user
    user = User(id=user_id, email="delete_me@example.com", locale="en", consent_version_accepted="1.0.0", data_retention_pref="standard")
    db_session.add(user)
    db_session.commit()

    db_session.add_all([
        BaselineProfile(user_id=user_id, answers_json={"survey": "done"}),
        Checkin(user_id=user_id, type="manual", mood_score=5),
        DailyStressIndex(user_id=user_id, date=today, score=50.0, computed_from=[]),
        ReliefSession(user_id=user_id, technique="grounding_54321"),
        WearableConnection(user_id=user_id, provider="apple_health"),
        CrisisEvent(user_id=user_id, triggered_by="manual_test", detector_version="1.0.0", resources_shown_json=[])
    ])
    db_session.commit()

    # Perform deletion
    del_res = client.post("/data/delete", json={"user_id": user_id, "confirm": True})
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Verify user record is completely removed
    db_session.expire_all()
    assert db_session.query(User).filter(User.id == user_id).first() is None
    assert db_session.query(BaselineProfile).filter(BaselineProfile.user_id == user_id).first() is None
    assert db_session.query(Checkin).filter(Checkin.user_id == user_id).first() is None
    assert db_session.query(DailyStressIndex).filter(DailyStressIndex.user_id == user_id).first() is None
    assert db_session.query(ReliefSession).filter(ReliefSession.user_id == user_id).first() is None
    assert db_session.query(WearableConnection).filter(WearableConnection.user_id == user_id).first() is None

    # Safety Guardrail: crisis_events is not destroyed, but user linkage is anonymized
    crisis_event = db_session.query(CrisisEvent).filter(CrisisEvent.triggered_by == "manual_test").first()
    assert crisis_event is not None
    assert crisis_event.user_id is None
