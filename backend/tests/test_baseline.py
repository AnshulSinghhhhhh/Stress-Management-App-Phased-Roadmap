"""Tests for User Baseline Profile API (IMPLEMENTATION_PLAN.md §0.2 and Phase 1)."""
import pytest

def test_create_and_get_baseline(client):
    user_id = "test_user_baseline_1"
    answers = {
        "q1_stress_frequency": "often",
        "q2_sleep_quality": "poor",
        "q3_primary_stressor": "workload",
        "q4_physical_symptoms": ["headache", "tight_shoulders"],
        "q5_coping_mechanism": "scrolling",
        "q6_preferred_relief": "breathing"
    }

    # 1. Post new baseline
    post_res = client.post("/baseline", json={"user_id": user_id, "answers": answers})
    assert post_res.status_code == 200
    data = post_res.json()
    assert data["user_id"] == user_id
    assert data["answers_json"] == answers
    assert data["status"] == "created"

    # 2. Get baseline
    get_res = client.get(f"/baseline?user_id={user_id}")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["user_id"] == user_id
    assert get_data["answers_json"] == answers

def test_cannot_retrigger_baseline_accidentally(client):
    user_id = "test_user_baseline_retrigger"
    answers_first = {"q1": "initial answer"}
    answers_second = {"q1": "attempted retrigger modification"}

    # Initial submission
    res1 = client.post("/api/v1/baseline", json={"user_id": user_id, "answers": answers_first})
    assert res1.status_code == 200
    assert res1.json()["answers_json"] == answers_first
    assert res1.json()["status"] == "created"

    # Re-trigger attempt: must return existing baseline without overwriting
    res2 = client.post("/api/v1/baseline", json={"user_id": user_id, "answers": answers_second})
    assert res2.status_code == 200
    assert res2.json()["answers_json"] == answers_first
    assert res2.json()["status"] == "already_exists"

    # Verification via GET
    get_res = client.get(f"/api/v1/baseline?user_id={user_id}")
    assert get_res.status_code == 200
    assert get_res.json()["answers_json"] == answers_first

def test_get_baseline_not_found(client):
    res = client.get("/baseline?user_id=nonexistent_user_99999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()
