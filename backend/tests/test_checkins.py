"""Tests for Daily Checkins and Stress Evaluation API (IMPLEMENTATION_PLAN.md §0.2, §0.4, Phase 1)."""
import pytest
from datetime import timedelta
from app.models import CrisisEvent, DailyStressIndex, Checkin, TriggerTag, utc_now

def test_create_checkin_and_recalculate_stress_index(client, db_session):
    user_id = "test_user_checkin_1"
    
    # 1. Create first checkin (morning, mood 8)
    res1 = client.post("/checkins", json={
        "user_id": user_id,
        "type": "morning",
        "mood_score": 8,
        "free_text": "Slept reasonably well, ready for the day ahead.",
        "emotional_tags": ["calm", "focused"]
    })
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["user_id"] == user_id
    assert data1["type"] == "morning"
    assert data1["mood_score"] == 8
    assert data1["crisis_response"] is None
    # Mood 8 -> (10 - 8) * 11.11 = 22.22
    assert data1["daily_stress_score"] == 22.22

    # Verify stress_index_daily entry was created in DB
    daily_idx = db_session.query(DailyStressIndex).filter(DailyStressIndex.user_id == user_id).first()
    assert daily_idx is not None
    assert daily_idx.score == 22.22
    assert len(daily_idx.computed_from) == 1

    # 2. Create second checkin on same day (evening, mood 4)
    res2 = client.post("/checkins", json={
        "user_id": user_id,
        "type": "evening",
        "mood_score": 4,
        "free_text": "Long day, feeling drained and a bit overwhelmed.",
        "emotional_tags": ["tired", "anxious"]
    })
    assert res2.status_code == 201
    data2 = res2.json()
    # Mood 4 -> (10 - 4) * 11.11 = 66.66. Average with 22.22 = (22.22 + 66.66)/2 = 44.44
    assert data2["daily_stress_score"] == 44.44

    # Verify updated in DB
    db_session.refresh(daily_idx)
    assert daily_idx.score == 44.44
    assert len(daily_idx.computed_from) == 2

def test_checkin_with_crisis_trigger(client, db_session):
    user_id = "test_user_crisis_checkin"

    # Post checkin with severe distress keyword
    res = client.post("/api/v1/checkins", json={
        "user_id": user_id,
        "type": "manual",
        "mood_score": 1,
        "free_text": "I can't cope anymore, I feel suicidal and don't want to live anymore.",
        "emotional_tags": ["hopeless"]
    })
    assert res.status_code == 201
    data = res.json()
    assert data["crisis_response"] is not None
    assert data["crisis_response"]["crisis_detected"] is True
    assert "Tele MANAS" in str(data["crisis_response"]["resources"])
    assert "14416" in str(data["crisis_response"]["resources"])
    assert "1800-599-0019" in str(data["crisis_response"]["resources"])
    assert "112" in str(data["crisis_response"]["resources"])

    # Verify immutable record logged to crisis_events table
    event = db_session.query(CrisisEvent).filter(CrisisEvent.user_id == user_id).first()
    assert event is not None
    assert event.triggered_by is not None
    assert "14416" in str(event.resources_shown_json)

def test_checkin_validation(client):
    # mood_score must be between 1 and 10
    res_low = client.post("/checkins", json={"user_id": "demo_user", "mood_score": 0, "type": "morning"})
    assert res_low.status_code == 422

    res_high = client.post("/checkins", json={"user_id": "demo_user", "mood_score": 11, "type": "morning"})
    assert res_high.status_code == 422

def test_list_checkins(client):
    user_id = "test_user_list_checkins"

    # Create 3 checkins
    client.post("/checkins", json={"user_id": user_id, "type": "morning", "mood_score": 7})
    client.post("/checkins", json={"user_id": user_id, "type": "evening", "mood_score": 5})
    client.post("/checkins", json={"user_id": user_id, "type": "manual", "mood_score": 3})

    # List all
    res = client.get(f"/checkins?user_id={user_id}")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 3

    # Filter by type
    res_morning = client.get(f"/checkins?user_id={user_id}&type=morning")
    assert res_morning.status_code == 200
    assert len(res_morning.json()) == 1
    assert res_morning.json()[0]["type"] == "morning"

    # Filter with limit
    res_limit = client.get(f"/checkins?user_id={user_id}&limit=2")
    assert res_limit.status_code == 200
    assert len(res_limit.json()) == 2

def test_reproduce_duplicate_checkin_bug_and_confirm_idempotency_fixed(client, db_session):
    """Reproduction & fix verification for identical check-ins double submission.
    
    Bug scenario:
      A double-fire on the UI or rapid retry submits identical check-ins (same user,
      type, mood_score, free_text, emotional_tags). Previously, both succeeded (201)
      and were saved as duplicate rows with near-identical timestamps.

    Fixed behavior:
      The second identical check-in within the 5-second idempotency window is
      rejected with HTTP 409 Conflict, preserving database integrity and returning
      a descriptive error.
    """
    user_id = "test_user_idempotent_duplicate"
    payload = {
        "user_id": user_id,
        "type": "morning",
        "mood_score": 7,
        "free_text": "Starting the morning with quiet clarity and herbal tea.",
        "emotional_tags": ["calm", "focused"]
    }

    # 1. First submission succeeds
    res1 = client.post("/checkins", json=payload)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["user_id"] == user_id
    assert data1["mood_score"] == 7
    first_id = data1["id"]

    # 2. Immediate duplicate submission (reproduces original double-fire bug)
    res2 = client.post("/checkins", json=payload)
    assert res2.status_code == 409, "Second identical submission must be rejected with 409 Conflict"
    err_detail = res2.json().get("detail", "")
    assert "duplicate" in err_detail.lower()

    # 3. Confirm only 1 checkin exists in the database
    checkins_in_db = db_session.query(Checkin).filter(Checkin.user_id == user_id).all()
    assert len(checkins_in_db) == 1
    assert checkins_in_db[0].id == first_id

    # 4. Confirm a distinct check-in from the same user (e.g. different mood) succeeds
    payload_different_mood = {
        "user_id": user_id,
        "type": "morning",
        "mood_score": 8,
        "free_text": "Starting the morning with quiet clarity and herbal tea.",
        "emotional_tags": ["calm", "focused"]
    }
    res_diff_mood = client.post("/checkins", json=payload_different_mood)
    assert res_diff_mood.status_code == 201

    # 5. Confirm a distinct check-in from the same user (different free text) succeeds
    payload_different_text = {
        "user_id": user_id,
        "type": "morning",
        "mood_score": 7,
        "free_text": "Actually noticed a slight change in how I feel.",
        "emotional_tags": ["calm", "focused"]
    }
    res_diff_text = client.post("/checkins", json=payload_different_text)
    assert res_diff_text.status_code == 201

    # 6. Confirm identical submission from a different user is NOT blocked
    payload_other_user = {
        "user_id": "test_another_user",
        "type": "morning",
        "mood_score": 7,
        "free_text": "Starting the morning with quiet clarity and herbal tea.",
        "emotional_tags": ["calm", "focused"]
    }
    res_other = client.post("/checkins", json=payload_other_user)
    assert res_other.status_code == 201

    # 7. Confirm that after the idempotency window has passed, identical check-in is accepted
    # Backdate all existing check-ins for this user past the 5-second window
    for chk in db_session.query(Checkin).filter(Checkin.user_id == user_id).all():
        chk.created_at = utc_now() - timedelta(seconds=10)
    db_session.commit()

    res_after_window = client.post("/checkins", json=payload)
    assert res_after_window.status_code == 201


def test_morning_checkin_creates_user_corrected_trigger_tag(client, db_session):
    """Morning check-in with trigger category chip creates a user_corrected TriggerTag (even without free text)."""
    user_id = "test_user_morning_trigger_chip"
    payload = {
        "user_id": user_id,
        "type": "morning",
        "mood_score": 6,
        "emotional_tags": ["Calm", "Focused"],
        "trigger_category": "sleep",
    }
    resp = client.post("/checkins", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    checkin_id = data["id"]

    # Verify a TriggerTag row was persisted with source='user_corrected' and category='sleep'
    tag = db_session.query(TriggerTag).filter(TriggerTag.checkin_id == checkin_id).first()
    assert tag is not None
    assert tag.category == "sleep"
    assert tag.source == "user_corrected"
    assert tag.confidence == 1.0
    assert tag.user_id == user_id


def test_evening_checkin_creates_user_corrected_trigger_tag_and_appends_example(client, db_session):
    """Evening check-in with reflective text and trigger category chip creates user_corrected tag and feeds few-shot."""
    user_id = "test_user_evening_reflective_chip"
    payload = {
        "user_id": user_id,
        "type": "evening",
        "mood_score": 4,
        "emotional_tags": ["Tired", "Overwhelmed"],
        "free_text": "Unexpected executive review deadline was dropped on my desk at 4 PM.",
        "trigger_category": "work",
    }
    resp = client.post("/checkins", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    checkin_id = data["id"]

    tag = db_session.query(TriggerTag).filter(TriggerTag.checkin_id == checkin_id).first()
    assert tag is not None
    assert tag.category == "work"
    assert tag.source == "user_corrected"
    assert tag.confidence == 1.0


