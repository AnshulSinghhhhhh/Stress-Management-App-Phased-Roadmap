"""Tests for Crisis Pathway and Safety-Critical Guardrails (IMPLEMENTATION_PLAN.md §0.4, SOP_ANTIGRAVITY.md §6)."""
import time
import pytest
from app.core.crisis_resources import INDIA_CRISIS_RESOURCES, CRISIS_DETECTOR_VERSION
from app.models import CrisisEvent

def test_crisis_detector_latency_under_50ms(client):
    """Safety requirement: Keyword layer must evaluate and respond in <50ms."""
    payload = {"text": "I feel like I want to die and end it all"}
    start_time = time.time()
    res = client.post("/crisis/check", json=payload)
    elapsed_ms = (time.time() - start_time) * 1000

    assert res.status_code == 200
    data = res.json()
    assert data["crisis_detected"] is True
    # Verify overall HTTP roundtrip is fast and internal detection latency is < 50ms
    assert data["detection_latency_ms"] < 50.0
    assert elapsed_ms < 100.0  # complete local network call well within safety margins

def test_crisis_resources_verification(client, db_session):
    """Verify all 3 official India helplines are returned correctly from app/core/crisis_resources.py."""
    payload = {"user_id": "test_user_crisis_direct", "text": "I want to commit suicide"}
    res = client.post("/crisis/check", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["crisis_detected"] is True
    assert data["detector_version"] == CRISIS_DETECTOR_VERSION

    # Verify resources
    resources = data["resources"]
    assert len(resources) == 3

    resource_ids = {r["id"] for r in resources}
    assert "tele_manas" in resource_ids
    assert "kiran" in resource_ids
    assert "emergency_112" in resource_ids

    tele_manas = next(r for r in resources if r["id"] == "tele_manas")
    assert tele_manas["number"] == "14416"
    assert tele_manas["tap_to_call"] == "tel:14416"

    kiran = next(r for r in resources if r["id"] == "kiran")
    assert kiran["number"] == "1800-599-0019"
    assert kiran["tap_to_call"] == "tel:18005990019"

    emergency = next(r for r in resources if r["id"] == "emergency_112")
    assert emergency["number"] == "112"
    assert emergency["tap_to_call"] == "tel:112"

    # Verify immutable log entry in crisis_events table
    event = db_session.query(CrisisEvent).filter(CrisisEvent.user_id == "test_user_crisis_direct").first()
    assert event is not None
    assert "commit suicide" in event.triggered_by
    assert event.detector_version == CRISIS_DETECTOR_VERSION

def test_manual_emergency_button_click(client, db_session):
    """Verify manual emergency trigger works without keywords."""
    res = client.post("/crisis/check", json={
        "user_id": "test_user_manual_emergency",
        "is_manual": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["crisis_detected"] is True
    assert len(data["resources"]) == 3

    event = db_session.query(CrisisEvent).filter(CrisisEvent.user_id == "test_user_manual_emergency").first()
    assert event is not None
    assert event.triggered_by == "manual_emergency_button"

def test_benign_text_does_not_trigger_crisis(client, db_session):
    """Verify standard stress/workload statements do NOT trigger false crisis events."""
    user_id = "test_user_benign_stress"
    res = client.post("/crisis/check", json={
        "user_id": user_id,
        "text": "I have an important presentation tomorrow and I feel stressed out and anxious."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["crisis_detected"] is False
    assert data.get("resources") is None

    # Verify no crisis_event was logged
    event = db_session.query(CrisisEvent).filter(CrisisEvent.user_id == user_id).first()
    assert event is None

def test_anonymous_crisis_access(client):
    """Verify crisis endpoint is completely login-free and accessible anonymously."""
    res = client.post("/api/v1/crisis/check", json={"text": "I can't go on anymore"})
    assert res.status_code == 200
    data = res.json()
    assert data["crisis_detected"] is True
    assert len(data["resources"]) == 3
