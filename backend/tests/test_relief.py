"""Tests for Relief Library and Active Sessions API (IMPLEMENTATION_PLAN.md §0.2 and Phase 1)."""
import pytest
from app.models import ReliefSession

def test_get_relief_techniques(client):
    res = client.get("/relief/techniques")
    assert res.status_code == 200
    techniques = res.json()
    assert len(techniques) == 3

    tech_ids = {t["id"] for t in techniques}
    assert "square_breathing" in tech_ids
    assert "grounding_54321" in tech_ids
    assert "micro_meditation" in tech_ids

    # Verify square breathing details
    sq = next(t for t in techniques if t["id"] == "square_breathing")
    assert sq["duration_seconds"] == 120
    assert "guidance_script" in sq
    assert len(sq["guidance_script"]) > 0

def test_relief_session_lifecycle(client, db_session):
    user_id = "test_user_relief_session"

    # 1. Start a session
    start_res = client.post("/relief/sessions", json={
        "user_id": user_id,
        "technique": "square_breathing"
    })
    assert start_res.status_code == 201
    session_data = start_res.json()
    session_id = session_data["id"]
    assert session_data["user_id"] == user_id
    assert session_data["technique"] == "square_breathing"
    assert session_data["started_at"] is not None
    assert session_data["completed_at"] is None
    assert session_data["self_reported_relief"] is None

    # 2. Complete session with relief rating 4
    complete_res = client.patch(f"/relief/sessions/{session_id}", json={
        "self_reported_relief": 4
    })
    assert complete_res.status_code == 200
    completed_data = complete_res.json()
    assert completed_data["completed_at"] is not None
    assert completed_data["self_reported_relief"] == 4

    # Verify in DB
    db_session.expire_all()
    session_db = db_session.query(ReliefSession).filter(ReliefSession.id == session_id).first()
    assert session_db.self_reported_relief == 4
    assert session_db.completed_at is not None

def test_relief_session_rating_validation(client):
    # Rating must be 1 to 5
    start_res = client.post("/relief/sessions", json={
        "user_id": "test_user_val",
        "technique": "grounding_54321"
    })
    session_id = start_res.json()["id"]

    # Rating 0 should fail validation
    res_low = client.patch(f"/relief/sessions/{session_id}", json={"self_reported_relief": 0})
    assert res_low.status_code == 422

    # Rating 6 should fail validation
    res_high = client.patch(f"/relief/sessions/{session_id}", json={"self_reported_relief": 6})
    assert res_high.status_code == 422

def test_complete_nonexistent_relief_session(client):
    res = client.patch("/relief/sessions/invalid-session-uuid-1234", json={"self_reported_relief": 3})
    assert res.status_code == 404
