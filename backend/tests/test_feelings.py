import pytest
from app.services.feeling_classifier import classify_feelings_local, classify_feelings, EMOTION_VOCABULARY

def test_feeling_classifier_vocabulary():
    assert len(EMOTION_VOCABULARY) == 8
    assert "Calm" in EMOTION_VOCABULARY
    assert "Tired" in EMOTION_VOCABULARY
    assert "Anxious" in EMOTION_VOCABULARY
    assert "Overwhelmed" in EMOTION_VOCABULARY

def test_feeling_classifier_empty_text():
    res = classify_feelings("")
    assert res["detected_feelings"] == []
    assert res["confidence"] is None

    res_none = classify_feelings(None)
    assert res_none["detected_feelings"] == []
    assert res_none["confidence"] is None

def test_feeling_classifier_local_detection():
    # Exhaustion / fatigue text
    feelings, conf = classify_feelings_local("I am completely exhausted, heavy eyes and drained of energy.")
    assert "Tired" in feelings
    assert conf > 0.35

    # Anxiety / panic text
    feelings, conf = classify_feelings_local("My heart is pounding and I feel intense nervous dread about the meeting.")
    assert "Anxious" in feelings or "Overwhelmed" in feelings
    assert conf > 0.35

    # Calm / peace text
    feelings, conf = classify_feelings_local("Sitting quietly with gentle breathing, feeling grounded and at peace.")
    assert "Calm" in feelings
    assert conf > 0.35

def test_checkin_feeling_detection_and_accept_api(client, db_session):
    user_id = "test_user_feelings_v2"
    # 1. Create checkin with free text
    res = client.post("/api/v1/checkins", json={
        "user_id": user_id,
        "type": "morning",
        "mood_score": 6,
        "free_text": "I woke up feeling completely exhausted and heavy, need rest.",
        "tags": ["Calm"],
        "idempotency_key": "feelings-test-key-1"
    })
    assert res.status_code == 201
    data = res.json()
    assert "Tired" in data["detected_feelings"]
    assert data["detected_feelings_confidence"] is not None
    assert data["detected_feelings_source"] == "embedding"
    checkin_id = data["id"]

    # 2. Patch accepted feelings
    patch_res = client.patch(f"/api/v1/checkins/{checkin_id}/feelings?user_id={user_id}", json={
        "feelings": ["Tired"]
    })
    assert patch_res.status_code == 200
    patch_data = patch_res.json()
    assert "Tired" in patch_data["emotional_tags"]
    assert "Calm" in patch_data["emotional_tags"]

