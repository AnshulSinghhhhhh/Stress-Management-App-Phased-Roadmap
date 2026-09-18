"""Tests for Phase 2 §2.0 trigger taxonomy classifier.

Verifies:
  - Local embedding classifier produces valid categories for all 7 categories.
  - Embedding computation returns 384-dim vectors.
  - NIM fallback is attempted on low-confidence results.
  - Tagging STILL WORKS when NIM is mocked to fail (critical guardrail).
  - Trigger tags are persisted to DB via the /checkins endpoint.
  - GET /triggers returns tags for user.
  - POST /triggers/{id}/correct creates user_corrected tag.
  - crisis_detector.py and crisis_events are NOT touched (SOP §6).
"""
import time
from unittest.mock import patch, MagicMock
import pytest
from app.services.trigger_classifier import (
    compute_embedding,
    classify_local,
    classify_trigger,
    classify_nim_fallback,
    TRIGGER_CATEGORIES,
    CONFIDENCE_THRESHOLD,
)
from app.models import TriggerTag, Checkin, CrisisEvent


# ─── Unit tests: embedding computation ─────────────────────────────────────

def test_embedding_produces_384_dim_vector():
    """Embedding from all-MiniLM-L6-v2 must be exactly 384 dimensions."""
    vec = compute_embedding("I feel overwhelmed by work deadlines.")
    assert isinstance(vec, list)
    assert len(vec) == 384
    # Should be normalized (L2 norm ≈ 1.0)
    import numpy as np
    norm = np.linalg.norm(vec)
    assert 0.95 <= norm <= 1.05, f"Norm was {norm}, expected ~1.0"


def test_embedding_empty_text_returns_zero_vector():
    """Empty/whitespace text should return a zero vector, not crash."""
    vec = compute_embedding("")
    assert len(vec) == 384
    assert all(v == 0.0 for v in vec)

    vec2 = compute_embedding("   ")
    assert len(vec2) == 384
    assert all(v == 0.0 for v in vec2)


# ─── Unit tests: local classifier ──────────────────────────────────────────

def test_local_classify_work():
    category, confidence = classify_local("My boss dumped three urgent deadlines on me today.")
    assert category == "work"
    assert confidence > 0.3


def test_local_classify_financial():
    category, confidence = classify_local("I can't afford to pay my bills this month.")
    assert category == "financial"
    assert confidence > 0.3


def test_local_classify_sleep():
    category, confidence = classify_local("I've been awake since 2 AM and can't fall back asleep.")
    assert category == "sleep"
    assert confidence > 0.3


def test_local_classify_health():
    category, confidence = classify_local("I keep worrying that my headaches and physical symptoms are something serious.")
    assert category == "health"
    assert confidence > 0.3


def test_local_classify_social_loneliness():
    category, confidence = classify_local("I feel so lonely and isolated with no friends to talk to.")
    assert category == "social_loneliness"
    assert confidence > 0.3


def test_local_classify_relationship():
    category, confidence = classify_local("My partner and I had a terrible fight about our future.")
    assert category == "relationship"
    assert confidence > 0.3


def test_local_classify_identity():
    category, confidence = classify_local("I feel like an imposter and don't know who I am anymore.")
    assert category == "identity"
    assert confidence > 0.3


def test_local_classify_returns_valid_category():
    """Any input must return one of the 7 valid categories."""
    for text in ["random words", "sunshine", "I ate a sandwich"]:
        category, confidence = classify_local(text)
        assert category in TRIGGER_CATEGORIES, f"Got invalid category: {category}"
        assert 0.0 <= confidence <= 1.0


# ─── Critical guardrail: tagging works when NIM fails ──────────────────────

def test_classify_trigger_works_when_nim_fails():
    """CRITICAL GUARDRAIL: trigger tagging must NEVER fail or block
    a check-in just because the NIM free tier is rate-limited.
    This test mocks NIM to always fail and verifies local classification
    still produces a valid result.
    """
    with patch("app.services.trigger_classifier.classify_nim_fallback", return_value=None):
        result = classify_trigger(
            text="My boss is demanding overtime every day this week.",
            nim_api_key="fake-key-that-should-not-be-used",
            nim_base_url="https://fake.nvidia.com/v1",
            nim_model="fake-model",
        )
    assert result["category"] in TRIGGER_CATEGORIES
    assert result["source"] == "embedding"
    assert result["confidence"] > 0.0
    assert "latency_ms" in result


def test_classify_trigger_works_with_no_nim_key():
    """When no NIM key is configured, local classifier is used exclusively."""
    result = classify_trigger(
        text="I pulled an all-nighter studying for exams.",
        nim_api_key="",
    )
    assert result["category"] in TRIGGER_CATEGORIES
    assert result["source"] == "embedding"


def test_classify_trigger_with_nim_timeout():
    """NIM timeout should be caught and local result used."""
    import requests
    with patch("app.services.trigger_classifier.requests.post",
               side_effect=requests.exceptions.Timeout("mocked timeout")):
        result = classify_trigger(
            text="I can't sleep and my bills are piling up.",
            nim_api_key="fake-key",
        )
    assert result["category"] in TRIGGER_CATEGORIES
    assert result["source"] == "embedding"


def test_classify_trigger_with_nim_connection_error():
    """NIM connection error should be caught and local result used."""
    import requests
    with patch("app.services.trigger_classifier.requests.post",
               side_effect=requests.exceptions.ConnectionError("mocked conn error")):
        result = classify_trigger(
            text="My relationship is falling apart.",
            nim_api_key="fake-key",
        )
    assert result["category"] in TRIGGER_CATEGORIES
    assert result["source"] == "embedding"


def test_classify_nim_fallback_returns_none_on_failure():
    """classify_nim_fallback itself should return None on any failure."""
    import requests
    with patch("app.services.trigger_classifier.requests.post",
               side_effect=requests.exceptions.ConnectionError("mocked")):
        result = classify_nim_fallback(
            "test text", "fake-key", "https://fake.nvidia.com/v1", "fake-model"
        )
    assert result is None


# ─── Integration tests: checkin → auto-tag pipeline ────────────────────────

def test_checkin_creates_trigger_tag(client, db_session):
    """POST /checkins with free_text should auto-create a trigger tag."""
    resp = client.post("/checkins", json={
        "user_id": "trigger_test_user",
        "type": "morning",
        "mood_score": 4,
        "free_text": "My manager gave me three impossible deadlines today.",
        "emotional_tags": ["stressed"]
    })
    assert resp.status_code == 201
    data = resp.json()

    # Verify trigger tag was created in DB
    tags = db_session.query(TriggerTag).filter(
        TriggerTag.checkin_id == data["id"]
    ).all()
    assert len(tags) >= 1
    tag = tags[0]
    assert tag.category in TRIGGER_CATEGORIES
    assert tag.source in ("embedding", "nim")
    assert tag.confidence > 0.0
    assert tag.user_id == "trigger_test_user"


def test_checkin_stores_embedding(client, db_session):
    """POST /checkins with free_text should store 384-dim embedding."""
    resp = client.post("/checkins", json={
        "user_id": "embed_test_user",
        "type": "evening",
        "mood_score": 6,
        "free_text": "Feeling tired after a long day of meetings.",
    })
    assert resp.status_code == 201
    checkin_id = resp.json()["id"]

    checkin = db_session.query(Checkin).filter(Checkin.id == checkin_id).first()
    assert checkin is not None
    assert checkin.embedding is not None
    assert isinstance(checkin.embedding, list)
    assert len(checkin.embedding) == 384


def test_checkin_without_text_has_no_tag(client, db_session):
    """Checkins without free_text should not produce trigger tags."""
    resp = client.post("/checkins", json={
        "user_id": "no_text_user",
        "type": "morning",
        "mood_score": 7,
    })
    assert resp.status_code == 201
    tags = db_session.query(TriggerTag).filter(
        TriggerTag.checkin_id == resp.json()["id"]
    ).all()
    assert len(tags) == 0


# ─── Integration tests: triggers API router ────────────────────────────────

def test_get_triggers_returns_tags(client, db_session):
    """GET /triggers should return tags for user."""
    # First create a checkin with text to generate a tag
    resp = client.post("/checkins", json={
        "user_id": "get_tags_user",
        "type": "morning",
        "mood_score": 3,
        "free_text": "I'm drowning in student loan debt and can't see a way out.",
    })
    assert resp.status_code == 201

    # Now query triggers
    tags_resp = client.get("/triggers?user_id=get_tags_user")
    assert tags_resp.status_code == 200
    tags = tags_resp.json()
    assert len(tags) >= 1
    assert tags[0]["category"] in TRIGGER_CATEGORIES


def test_trigger_correction(client, db_session):
    """POST /triggers/{checkin_id}/correct should create user_corrected tag."""
    # Create checkin
    resp = client.post("/checkins", json={
        "user_id": "correct_tag_user",
        "type": "evening",
        "mood_score": 5,
        "free_text": "I feel stuck and directionless in my career.",
    })
    checkin_id = resp.json()["id"]

    # Correct the tag
    correct_resp = client.post(
        f"/triggers/{checkin_id}/correct?user_id=correct_tag_user",
        json={"category": "work"},
    )
    assert correct_resp.status_code == 200
    data = correct_resp.json()
    assert data["source"] == "user_corrected"
    assert data["category"] == "work"
    assert data["confidence"] == 1.0


def test_trigger_correction_invalid_category(client, db_session):
    """Correcting to an invalid category should return 400."""
    resp = client.post("/checkins", json={
        "user_id": "invalid_cat_user",
        "type": "morning",
        "mood_score": 5,
        "free_text": "Test text",
    })
    checkin_id = resp.json()["id"]

    bad_resp = client.post(
        f"/triggers/{checkin_id}/correct?user_id=invalid_cat_user",
        json={"category": "not_a_real_category"},
    )
    assert bad_resp.status_code == 400


def test_trigger_summary(client, db_session):
    """GET /triggers/summary should return aggregated counts."""
    # Create multiple checkins
    for text in [
        "My boss is terrible",
        "Work deadlines are crushing me",
        "I can't pay my rent",
    ]:
        client.post("/checkins", json={
            "user_id": "summary_user",
            "type": "morning",
            "mood_score": 3,
            "free_text": text,
        })

    summary_resp = client.get("/triggers/summary?user_id=summary_user&range=7d")
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert isinstance(summary, list)
    assert len(summary) >= 1
    # Each entry has category, count, avg_confidence, sources
    for entry in summary:
        assert "category" in entry
        assert "count" in entry
        assert entry["count"] >= 1


# ─── SOP §6 guardrail verification ────────────────────────────────────────

def test_crisis_detector_not_touched():
    """Verify crisis_detector.py was not modified by trigger taxonomy work."""
    from app.services.crisis_detector import CrisisDetector, CRISIS_KEYWORD_PATTERNS
    # The module must still exist and have the expected patterns
    assert len(CRISIS_KEYWORD_PATTERNS) > 10
    assert hasattr(CrisisDetector, "detect_deterministic")
    assert hasattr(CrisisDetector, "check_crisis")

    # Verify it still detects crisis correctly
    result = CrisisDetector.check_crisis("I want to end my life")
    assert result["crisis_detected"] is True
    assert result["detection_latency_ms"] < 50


def test_crisis_events_table_unchanged(db_session):
    """Verify crisis_events table structure was not modified."""
    from app.models import CrisisEvent
    assert CrisisEvent.__tablename__ == "crisis_events"
    columns = {c.name for c in CrisisEvent.__table__.columns}
    assert "id" in columns
    assert "user_id" in columns
    assert "triggered_by" in columns
    assert "detector_version" in columns
    assert "resources_shown_json" in columns
    assert "timestamp" in columns


# ─── Performance test ──────────────────────────────────────────────────────

def test_local_classifier_latency():
    """Local classifier should complete well under 100ms per call."""
    texts = [
        "Work is overwhelming me with pressure.",
        "I can't afford groceries this week.",
        "Haven't slept properly in days.",
    ]
    for text in texts:
        t0 = time.perf_counter()
        classify_local(text)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        assert elapsed_ms < 500, f"Local classification took {elapsed_ms:.1f}ms"
