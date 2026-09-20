"""Unit and integration tests for v2 features:
- Consent API (grant, revoke, status, audit trail)
- Baseline snapshots & active questionnaire catalog
- Checkin idempotency keys & duplicate rejection
- Calibrated stress indicators & Kish's N_eff
- Longitudinal trends & distinct-day minimum-N gating
- Pacing status check & soft branch
"""
import pytest
import uuid
from datetime import timedelta
from app.models import Checkin, BaselineSnapshot, ConsentLog, utc_now

def test_consent_api_flow(client, db_session):
    user_id = "test_user_consent_v2"

    # 1. Initial status
    res = client.get(f"/api/v1/consent/status?user_id={user_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == user_id
    assert data["active_consents"]["terms_and_privacy"] is True

    # 2. Grant wearable_data consent
    grant_res = client.post("/api/v1/consent", json={
        "user_id": user_id,
        "consent_type": "wearable_data",
        "version": "2.0.0"
    })
    assert grant_res.status_code == 201
    grant_data = grant_res.json()
    assert grant_data["consent_type"] == "wearable_data"
    assert grant_data["granted"] is True

    # 3. Verify in status
    res2 = client.get(f"/api/v1/consent/status?user_id={user_id}")
    assert res2.json()["active_consents"]["wearable_data"] is True

    # 4. Revoke wearable_data consent
    revoke_res = client.post("/api/v1/consent/revoke", json={
        "user_id": user_id,
        "consent_type": "wearable_data"
    })
    assert revoke_res.status_code == 200
    assert revoke_res.json()["granted"] is False

    # 5. Verify revoked in status
    res3 = client.get(f"/api/v1/consent/status?user_id={user_id}")
    assert res3.json()["active_consents"]["wearable_data"] is False
    assert len(res3.json()["history"]) >= 2

def test_questionnaire_catalog_and_baseline_snapshot(client, db_session):
    user_id = "test_user_baseline_snapshot_v2"

    # 1. Fetch catalog
    cat_res = client.get("/api/v1/baseline/catalog")
    assert cat_res.status_code == 200
    cat = cat_res.json()
    assert "baseline_anchor" in cat
    assert "who5_adapted" in cat["baseline_anchor"]["scale_name"]
    assert len(cat["baseline_anchor"]["items"]) == 5
    assert len(cat["somatic_profile"]["items"]) == 5

    # 2. Create snapshot
    answers = {
        "who5_cheerful": 4,
        "who5_calm": 3,
        "who5_active": 4,
        "who5_rested": 3,
        "who5_interest": 4,
        "physical_manifestation": "Tightness in shoulders & neck"
    }
    snap_res = client.post("/api/v1/baseline/snapshot", json={
        "user_id": user_id,
        "scale_name": "who5_adapted",
        "answers": answers
    })
    assert snap_res.status_code == 201
    snap = snap_res.json()
    assert snap["user_id"] == user_id
    assert snap["score_normalized"] >= 0.0
    # raw sum = 18/25 = 72% wellbeing -> 28% baseline stress
    assert snap["score_normalized"] == 28.0

    # 3. List snapshots
    list_res = client.get(f"/api/v1/baseline/snapshots?user_id={user_id}")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

def test_checkin_explicit_idempotency_key(client, db_session):
    user_id = "test_user_idem_key_v2"
    key = str(uuid.uuid4())

    payload = {
        "user_id": user_id,
        "idempotency_key": key,
        "type": "morning",
        "mood_score": 7,
        "free_text": "Good morning walk.",
        "emotional_tags": ["Calm"]
    }

    # First succeeds
    res1 = client.post("/api/v1/checkins", json=payload)
    assert res1.status_code == 201
    assert res1.json()["idempotency_key"] == key

    # Re-sending with same idempotency_key is rejected with 409
    res2 = client.post("/api/v1/checkins", json=payload)
    assert res2.status_code == 409
    assert "duplicate" in res2.json()["detail"].lower()

def test_pacing_check(client, db_session):
    user_id = "test_user_pacing_v2"

    # Initially no check-in exists
    res1 = client.get(f"/api/v1/checkins/pacing/check?user_id={user_id}")
    assert res1.status_code == 200
    assert res1.json()["recent_checkin_exists"] is False
    assert res1.json()["soft_branch_recommended"] is False

    # Post elevated stress checkin (mood 2 -> stress ~88)
    client.post("/api/v1/checkins", json={
        "user_id": user_id,
        "type": "manual",
        "mood_score": 2,
        "emotional_tags": ["Overwhelmed"],
        "free_text": "Feeling immense pressure right now."
    })

    # Check pacing status immediately
    res2 = client.get(f"/api/v1/checkins/pacing/check?user_id={user_id}")
    assert res2.status_code == 200
    assert res2.json()["recent_checkin_exists"] is True
    assert res2.json()["soft_branch_recommended"] is True
    assert "Your nervous system is still processing" in res2.json()["advisory_copy"]

def test_calibrated_stress_indicators_and_minimum_n(client, db_session):
    user_id = "test_user_calibrated_v2"

    # Check with 1 check-in (D_distinct < 5 -> status: calibrating)
    client.post("/api/v1/checkins", json={
        "user_id": user_id,
        "type": "morning",
        "mood_score": 8,
        "emotional_tags": ["Calm"]
    })

    res = client.get(f"/api/v1/stress-index/indicators/current?user_id={user_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "calibrating"
    assert data["minimum_n_met"] is False
    assert data["distinct_days"] == 1
    assert "Day 1 of 5" in data["status_copy"]

    # Check trends endpoint
    trends_res = client.get(f"/api/v1/stress-index/trends?user_id={user_id}&range=7d")
    assert trends_res.status_code == 200
    trends = trends_res.json()
    assert trends["status"] == "calibrating"
    assert trends["minimum_n_met"] is False
    assert len(trends["points"]) == 7

def test_get_today_checkins(client, db_session):
    user_id = "test_user_today_diurnal"

    client.post("/api/v1/checkins", json={
        "user_id": user_id,
        "type": "morning",
        "mood_score": 8,
        "emotional_tags": ["Calm"]
    })
    client.post("/api/v1/checkins", json={
        "user_id": user_id,
        "type": "afternoon",
        "mood_score": 6,
        "emotional_tags": ["Focused"]
    })

    res = client.get(f"/api/v1/checkins/today?user_id={user_id}")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    assert items[0]["type"] == "morning"
    assert items[1]["type"] == "afternoon"
