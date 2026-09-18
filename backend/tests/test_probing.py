"""Tests for Phase 2 §2.0 deeper CBT-style probing feature.

Verifies:
  1. Recurrence trigger: triggers when category recurs >=3x in rolling 14-day window.
  2. Rolling window: check-ins older than 14 days do not count toward recurrence.
  3. Retrieval scoping: retrieval is strictly scoped to user_id (NEVER crosses users).
  4. Retrieval excludes current check-in.
  5. Prompt grounding: prompt contains user's actual phrasing from past check-ins.
  6. Clinical safety: system prompt enforces no advice, no diagnosis, exactly one question.
  7. Fail-open guardrails: check-in succeeds with 201 when NIM times out, errors, or rate limits.
  8. Guardrail: crisis_detector.py and crisis_events are untouched (SOP §6).
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import pytest
import requests

from app.models import Checkin, TriggerTag, CrisisEvent, utc_now
from app.services.probing import (
    check_category_recurrence,
    retrieve_similar_past_checkins,
    build_probing_messages,
    generate_probing_question,
    maybe_generate_probing_question,
    CBT_SYSTEM_PROMPT,
)
from app.services.trigger_classifier import compute_embedding


# ─── 1. Recurrence Trigger Tests ──────────────────────────────────────────

def test_recurrence_below_threshold_returns_none(db_session):
    """When a category has occurred < 3 times, no question is generated."""
    user_id = "user_recurrence_low"
    now = utc_now()

    # Create 2 past tags for 'work'
    for i in range(2):
        tag = TriggerTag(
            checkin_id=f"chk_low_{i}",
            user_id=user_id,
            category="work",
            confidence=0.8,
            source="embedding",
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(tag)
    db_session.commit()

    count = check_category_recurrence(db_session, user_id, "work", window_days=14)
    assert count == 2

    # maybe_generate_probing_question should return None because count < 3
    result = maybe_generate_probing_question(
        db=db_session,
        user_id=user_id,
        current_checkin_id="curr_chk",
        current_text="Another busy work day.",
        category="work",
        target_embedding=compute_embedding("Another busy work day."),
        min_recurrence=3,
        window_days=14,
    )
    assert result is None


def test_recurrence_at_or_above_threshold_triggers_probing(db_session):
    """When a category recurs >= 3 times in 14 days, probing is triggered."""
    user_id = "user_recurrence_high"
    now = utc_now()
    embed = compute_embedding("Work deadlines and meetings are piling up.")

    # Create 3 past check-ins with tags for 'work'
    for i in range(3):
        chk = Checkin(
            id=f"chk_high_{i}",
            user_id=user_id,
            type="morning",
            mood_score=4,
            free_text=f"Past reflection {i}: overwhelmed by work deadlines and meetings.",
            embedding=embed,
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(chk)
        tag = TriggerTag(
            checkin_id=chk.id,
            user_id=user_id,
            category="work",
            confidence=0.85,
            source="embedding",
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(tag)
    db_session.commit()

    count = check_category_recurrence(db_session, user_id, "work", window_days=14)
    assert count == 3

    # Mock NIM to return a CBT question
    mock_cbt_q = "What patterns do you notice when your workload starts feeling overwhelming like this?"
    with patch("app.services.probing.generate_chat_completion", return_value=mock_cbt_q):
        result = maybe_generate_probing_question(
            db=db_session,
            user_id=user_id,
            current_checkin_id="new_curr_chk",
            current_text="My manager gave me three new urgent deadlines.",
            category="work",
            target_embedding=embed,
            min_recurrence=3,
            window_days=14,
        )

    assert result is not None
    assert result.endswith("?")
    assert result == mock_cbt_q


def test_recurrence_window_excludes_older_than_14_days(db_session):
    """Check-ins older than 14 days do not count toward the rolling recurrence."""
    user_id = "user_recurrence_window"
    now = utc_now()

    # 2 tags from 20 days ago (outside 14-day window)
    for i in range(2):
        tag_old = TriggerTag(
            checkin_id=f"chk_old_{i}",
            user_id=user_id,
            category="financial",
            confidence=0.9,
            source="embedding",
            created_at=now - timedelta(days=20 + i),
        )
        db_session.add(tag_old)

    # 1 tag within 14 days
    tag_recent = TriggerTag(
        checkin_id="chk_rec_1",
        user_id=user_id,
        category="financial",
        confidence=0.9,
        source="embedding",
        created_at=now - timedelta(days=2),
    )
    db_session.add(tag_recent)
    db_session.commit()

    # Count within 14 days should be 1 (not 3)
    count = check_category_recurrence(db_session, user_id, "financial", window_days=14)
    assert count == 1

    result = maybe_generate_probing_question(
        db=db_session,
        user_id=user_id,
        current_checkin_id="curr_fin",
        current_text="Can't pay rent.",
        category="financial",
        target_embedding=compute_embedding("Can't pay rent."),
        min_recurrence=3,
        window_days=14,
    )
    assert result is None


# ─── 2. Retrieval Scoping Tests (NEVER crosses users) ──────────────────────

def test_retrieval_scoping_never_crosses_users(db_session):
    """CRITICAL SECURITY/PRIVACY GUARDRAIL:
    Retrieval is strictly scoped to `user_id`. Past check-ins from User B
    must NEVER be returned when retrieving for User A, even if User B's
    check-in has a higher similarity.
    """
    user_a = "user_alice_privacy"
    user_b = "user_bob_privacy"
    now = utc_now()

    # Target embedding for a work query
    target_embed = compute_embedding("Deadlines and presentations at work.")

    # User B has a very similar check-in
    chk_b = Checkin(
        id="chk_bob_secret",
        user_id=user_b,
        type="morning",
        mood_score=3,
        free_text="SECRET BOB TEXT: Deadlines and presentations at work are crushing me.",
        embedding=target_embed,  # exact same embedding
        created_at=now - timedelta(days=1),
    )
    db_session.add(chk_b)

    # User A has their own check-in
    chk_a = Checkin(
        id="chk_alice_safe",
        user_id=user_a,
        type="morning",
        mood_score=5,
        free_text="Alice personal note: busy day with projects.",
        embedding=compute_embedding("busy day with projects"),
        created_at=now - timedelta(days=2),
    )
    db_session.add(chk_a)
    db_session.commit()

    # Retrieve for Alice
    retrieved = retrieve_similar_past_checkins(
        db=db_session,
        user_id=user_a,
        target_embedding=target_embed,
        top_k=3,
    )

    # Verify:
    assert len(retrieved) == 1
    assert retrieved[0].id == "chk_alice_safe"
    assert retrieved[0].user_id == user_a
    assert "SECRET BOB TEXT" not in retrieved[0].free_text

    # None of the retrieved check-ins belong to User B
    for c in retrieved:
        assert c.user_id == user_a
        assert c.user_id != user_b


def test_retrieval_excludes_current_checkin(db_session):
    """Retrieval must exclude the check-in currently being submitted."""
    user_id = "user_curr_chk_test"
    now = utc_now()
    embed = compute_embedding("feeling stressed about health")

    chk_current = Checkin(
        id="current_id_123",
        user_id=user_id,
        type="manual",
        mood_score=4,
        free_text="Feeling stressed about my health today.",
        embedding=embed,
        created_at=now,
    )
    chk_past = Checkin(
        id="past_id_456",
        user_id=user_id,
        type="morning",
        mood_score=5,
        free_text="Past health concern: headache and tired.",
        embedding=embed,
        created_at=now - timedelta(days=3),
    )
    db_session.add_all([chk_current, chk_past])
    db_session.commit()

    retrieved = retrieve_similar_past_checkins(
        db=db_session,
        user_id=user_id,
        target_embedding=embed,
        current_checkin_id="current_id_123",
        top_k=3,
    )

    retrieved_ids = [c.id for c in retrieved]
    assert "current_id_123" not in retrieved_ids
    assert "past_id_456" in retrieved_ids


# ─── 3. Prompt Grounding & Clinical Safety Tests ───────────────────────────

def test_prompt_includes_actual_user_phrasing():
    """Prompt must include actual verbatim phrases from the retrieved past check-ins."""
    past_chk_1 = MagicMock()
    past_chk_1.free_text = "I stayed at work until midnight finishing slides."
    past_chk_2 = MagicMock()
    past_chk_2.free_text = "My manager scheduled back-to-back reviews."

    current_text = "Drowning in deadlines again today."
    category = "work"

    messages = build_probing_messages(current_text, category, [past_chk_1, past_chk_2])

    assert len(messages) == 2
    system_msg = messages[0]["content"]
    user_msg = messages[1]["content"]

    # Clinical safety in system prompt
    assert "NEVER give advice" in system_msg
    assert "NEVER provide a diagnosis" in system_msg
    assert "EXACTLY ONE" in system_msg

    # Grounding in user phrasing
    assert "I stayed at work until midnight finishing slides." in user_msg
    assert "My manager scheduled back-to-back reviews." in user_msg
    assert "Drowning in deadlines again today." in user_msg


def test_probing_question_formatting():
    """Ensure probing question is cleaned, unquoted, and ends with a question mark."""
    with patch("app.services.probing.generate_chat_completion",
               return_value='"What assumptions are you making about your deadlines?"'):
        past_chk = MagicMock()
        past_chk.free_text = "Work is hard."
        q = generate_probing_question("Busy day.", "work", [past_chk])
        assert q == "What assumptions are you making about your deadlines?"
        assert q.endswith("?")
        assert not q.startswith('"')
        assert not q.endswith('"')


# ─── 4. NIM-Failure Fail-Open Tests ────────────────────────────────────────

def test_nim_timeout_fails_open(client, db_session):
    """FAIL-OPEN GUARDRAIL: when NIM times out, check-in returns 201
    and probing_question is None. Check-in is NOT blocked.
    """
    user_id = "user_nim_timeout"
    now = utc_now()
    embed = compute_embedding("Overwhelmed by work deadlines.")

    # Seed 2 prior check-ins for 'work' so this next one is the 3rd recurrence
    for i in range(2):
        chk = Checkin(
            id=f"chk_to_{i}",
            user_id=user_id,
            type="morning",
            mood_score=4,
            free_text=f"Work pressure note {i}",
            embedding=embed,
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(chk)
        tag = TriggerTag(
            checkin_id=chk.id,
            user_id=user_id,
            category="work",
            confidence=0.88,
            source="embedding",
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(tag)
    db_session.commit()

    # Mock NIM chat completion to simulate a Timeout
    with patch("app.ai.nim_client.requests.post", side_effect=requests.exceptions.Timeout("Timeout")):
        resp = client.post("/checkins", json={
            "user_id": user_id,
            "type": "evening",
            "mood_score": 4,
            "free_text": "My manager piled on another three urgent deadlines today.",
        })

    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] is not None
    # Fail-open: probing_question is None rather than crashing
    assert data["probing_question"] is None


def test_nim_connection_error_fails_open(client, db_session):
    """FAIL-OPEN GUARDRAIL: connection error to NIM returns 201 without blocking."""
    user_id = "user_nim_conn_err"
    now = utc_now()
    embed = compute_embedding("Sleep insomnia issues.")

    for i in range(2):
        chk = Checkin(
            id=f"chk_conn_{i}",
            user_id=user_id,
            type="morning",
            mood_score=3,
            free_text=f"Woke up at 3 AM note {i}",
            embedding=embed,
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(chk)
        tag = TriggerTag(
            checkin_id=chk.id,
            user_id=user_id,
            category="sleep",
            confidence=0.9,
            source="embedding",
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(tag)
    db_session.commit()

    with patch("app.ai.nim_client.requests.post", side_effect=requests.exceptions.ConnectionError("Connection refused")):
        resp = client.post("/checkins", json={
            "user_id": user_id,
            "type": "morning",
            "mood_score": 3,
            "free_text": "I haven't slept more than three hours tonight with insomnia.",
        })

    assert resp.status_code == 201
    assert resp.json()["probing_question"] is None


def test_nim_http_error_fails_open(client, db_session):
    """FAIL-OPEN GUARDRAIL: NIM returning HTTP 500 or 429 returns 201 without blocking."""
    user_id = "user_nim_500"
    now = utc_now()
    embed = compute_embedding("Relationship difficulties.")

    for i in range(2):
        chk = Checkin(
            id=f"chk_500_{i}",
            user_id=user_id,
            type="morning",
            mood_score=4,
            free_text=f"Argument with spouse note {i}",
            embedding=embed,
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(chk)
        tag = TriggerTag(
            checkin_id=chk.id,
            user_id=user_id,
            category="relationship",
            confidence=0.85,
            source="embedding",
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(tag)
    db_session.commit()

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "Internal Server Error"

    with patch("app.ai.nim_client.requests.post", return_value=mock_resp):
        resp = client.post("/checkins", json={
            "user_id": user_id,
            "type": "evening",
            "mood_score": 4,
            "free_text": "My partner and I had a huge fight again tonight.",
        })

    assert resp.status_code == 201
    assert resp.json()["probing_question"] is None


def test_nim_success_returns_question_in_checkin_response(client, db_session):
    """When NIM succeeds on 3+ recurrence, probing_question is included in check-in response."""
    user_id = "user_nim_success"
    now = utc_now()
    embed = compute_embedding("Financial anxiety and rent.")

    for i in range(2):
        chk = Checkin(
            id=f"chk_succ_{i}",
            user_id=user_id,
            type="morning",
            mood_score=3,
            free_text=f"Rent and credit card anxiety note {i}",
            embedding=embed,
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(chk)
        tag = TriggerTag(
            checkin_id=chk.id,
            user_id=user_id,
            category="financial",
            confidence=0.9,
            source="embedding",
            created_at=now - timedelta(days=i + 1),
        )
        db_session.add(tag)
    db_session.commit()

    expected_q = "When you think about your finances, what story do you notice your mind telling you?"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": expected_q
                }
            }
        ]
    }

    with patch("app.ai.nim_client.requests.post", return_value=mock_resp):
        resp = client.post("/checkins", json={
            "user_id": user_id,
            "type": "morning",
            "mood_score": 3,
            "free_text": "I can't make rent this month and my emergency fund is gone.",
        })

    assert resp.status_code == 201
    data = resp.json()
    assert data["probing_question"] == expected_q


# ─── 5. SOP §6 Guardrail Verification ─────────────────────────────────────

def test_crisis_detector_and_events_untouched():
    """Verify crisis_detector.py and crisis_events remain completely untouched."""
    from app.services.crisis_detector import CrisisDetector, CRISIS_KEYWORD_PATTERNS
    assert len(CRISIS_KEYWORD_PATTERNS) > 10
    result = CrisisDetector.check_crisis("I want to end my life")
    assert result["crisis_detected"] is True
    assert result["detection_latency_ms"] < 50

    from app.models import CrisisEvent
    assert CrisisEvent.__tablename__ == "crisis_events"
