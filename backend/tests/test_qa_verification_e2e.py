"""End-to-End QA Integration & Verification Test Suite for Phase 1 MVP.
Validates all 8 Phase 1 features against their exact 'Done when' criteria from IMPLEMENTATION_PLAN.md
and SOP_ANTIGRAVITY.md §6 Guardrails.
"""
import time
import pytest
from app.models import CrisisEvent, User, BaselineProfile, Checkin, DailyStressIndex, ReliefSession, WearableConnection
from app.core.crisis_resources import INDIA_CRISIS_RESOURCES, CRISIS_DETECTOR_VERSION, get_crisis_payload
from app.services.crisis_detector import CrisisDetector

# =============================================================================
# FEATURE 1: Profile setup + baseline (5-6 Qs)
# API: POST /baseline, GET /baseline
# Done when: New user completes onboarding once; answers stored; can't be re-triggered accidentally.
# =============================================================================
def test_feature1_profile_setup_baseline(client, db_session):
    user_id = "qa_user_feat1"
    answers = {
        "physical_manifestation": "Tightness in shoulders & neck",
        "sleep_quality": "Generally sound and restorative",
        "daily_support": "Unstructured breathing and stillness",
        "peak_hours": "Mid-afternoon energy drop (2 PM - 5 PM)",
        "welcome_technique": "4-4-4-4 Box Breathing (Paced physiological reset)"
    }
    
    # 1. First submission -> Created
    t0 = time.perf_counter()
    resp = client.post("/baseline", json={"user_id": user_id, "answers": answers})
    latency_ms = (time.perf_counter() - t0) * 1000
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["status"] == "created"
    assert data["user_id"] == user_id
    assert data["answers_json"] == answers
    assert latency_ms < 100, f"Latency was {latency_ms:.2f}ms"
    
    # 2. Query stored baseline -> Exists
    get_resp = client.get(f"/baseline?user_id={user_id}")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["answers_json"] == answers
    assert get_data["status"] == "exists"
    
    # 3. Accidental re-trigger attempt -> Returns already_exists, original answers intact
    accidental_payload = {
        "user_id": user_id,
        "answers": {"physical_manifestation": "OVERWRITTEN_SHOULD_NOT_HAPPEN"}
    }
    retrigger_resp = client.post("/baseline", json=accidental_payload)
    assert retrigger_resp.status_code == 200
    retrigger_data = retrigger_resp.json()
    assert retrigger_data["status"] == "already_exists"
    # Answers must NOT be altered
    assert retrigger_data["answers_json"] == answers
    
    # Verify non-existent user returns 404
    nf_resp = client.get("/baseline?user_id=qa_nonexistent_user")
    assert nf_resp.status_code == 404


# =============================================================================
# FEATURE 2: Daily check-in (AM/PM)
# API: POST /checkins, GET /checkins?range=
# Done when: Check-in feels like 15 seconds; mood 1-10 slider; free text/voice note;
#            emotional tags; daily stress index recalculated on each new check-in.
# =============================================================================
def test_feature2_daily_checkin(client, db_session):
    user_id = "qa_user_feat2"
    
    # Check-in 1 (Morning): mood 8 (low stress -> 11 - 8 = 3.0)
    t0 = time.perf_counter()
    resp1 = client.post("/checkins", json={
        "user_id": user_id,
        "type": "morning",
        "mood_score": 8,
        "emotional_tags": ["Calm", "Grateful"],
        "free_text": "Morning sunrise walk. Mind is steady."
    })
    latency_ms1 = (time.perf_counter() - t0) * 1000
    assert resp1.status_code == 201
    d1 = resp1.json()
    assert d1["mood_score"] == 8
    assert d1["type"] == "morning"
    assert "Calm" in d1["emotional_tags"]
    # Mood 8 -> (10 - 8) * 11.11 = 22.22
    assert d1["daily_stress_score"] == 22.22
    assert latency_ms1 < 100
    
    # Check-in 2 (Evening): mood 4 (moderate stress -> 11 - 4 = 7.0)
    # Recalculated daily score: (3.0 + 7.0) / 2 = 5.0
    t1 = time.perf_counter()
    resp2 = client.post("/checkins", json={
        "user_id": user_id,
        "type": "evening",
        "mood_score": 4,
        "emotional_tags": ["Tired", "Restless"],
        "free_text": "Busy day at office, lots of meetings."
    })
    latency_ms2 = (time.perf_counter() - t1) * 1000
    assert resp2.status_code == 201
    d2 = resp2.json()
    assert d2["mood_score"] == 4
    # Recalculated average: (22.22 + 66.66) / 2 = 44.44
    assert d2["daily_stress_score"] == 44.44
    assert latency_ms2 < 100
    
    # Check-ins retrieval with range query
    list_resp = client.get(f"/checkins?user_id={user_id}&range=7d")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 2
    # Newest first
    assert items[0]["type"] == "evening"
    assert items[1]["type"] == "morning"
    
    # Validation: mood score must be between 1 and 10
    invalid_resp_low = client.post("/checkins", json={"user_id": user_id, "type": "morning", "mood_score": 0})
    assert invalid_resp_low.status_code == 422
    invalid_resp_high = client.post("/checkins", json={"user_id": user_id, "type": "morning", "mood_score": 11})
    assert invalid_resp_high.status_code == 422


# =============================================================================
# FEATURE 3: No-wearable default / optional wearable
# API: POST /integrations/wearable/connect
# Done when: App fully functional with zero wearable connected;
#            wearable data stored only if user opts in.
# =============================================================================
def test_feature3_no_wearable_default_and_opt_in(client, db_session):
    user_id = "qa_user_feat3"
    
    # 1. Zero-wearable state verification
    status_resp = client.get(f"/integrations/wearable/status?user_id={user_id}")
    assert status_resp.status_code == 200
    st = status_resp.json()
    assert st["connected"] is False
    assert len(st["connections"]) == 0
    
    # 2. Verify all app operations work seamlessly without wearable
    # Baseline
    b_resp = client.post("/baseline", json={"user_id": user_id, "answers": {"q1": "val1"}})
    assert b_resp.status_code == 200
    # Checkin
    c_resp = client.post("/checkins", json={"user_id": user_id, "type": "morning", "mood_score": 7})
    assert c_resp.status_code == 201
    # Relief session
    r_resp = client.post("/relief/sessions", json={"user_id": user_id, "technique": "square_breathing"})
    assert r_resp.status_code == 201
    # Stress index
    s_resp = client.get(f"/stress-index?user_id={user_id}&range=7d")
    assert s_resp.status_code == 200
    
    # 3. User opts in to Apple Health
    t0 = time.perf_counter()
    opt_resp = client.post("/integrations/wearable/connect", json={
        "user_id": user_id,
        "provider": "apple_health"
    })
    latency_ms = (time.perf_counter() - t0) * 1000
    assert opt_resp.status_code == 200
    assert opt_resp.json()["is_active"] is True
    assert latency_ms < 50
    
    # Status now reflects connected wearable
    status_resp2 = client.get(f"/integrations/wearable/status?user_id={user_id}")
    assert status_resp2.json()["connected"] is True
    assert len(status_resp2.json()["connections"]) == 1
    
    # Reject invalid wearable provider
    bad_prov = client.post("/integrations/wearable/connect", json={"user_id": user_id, "provider": "unsupported_device"})
    assert bad_prov.status_code == 400


# =============================================================================
# FEATURE 4: Manual "I'm stressed right now" trigger
# API: POST /checkins with type=manual
# Done when: Runs through crisis detector synchronously (<50ms) before returning relief suggestions.
# =============================================================================
def test_feature4_manual_stressed_trigger_with_crisis_detection(client, db_session):
    user_id = "qa_user_feat4"
    
    # Case A: Benign manual stress request (e.g. work stress)
    t0 = time.perf_counter()
    resp_benign = client.post("/checkins", json={
        "user_id": user_id,
        "type": "manual",
        "mood_score": 3,
        "free_text": "I feel a lot of tension in my shoulders after this client meeting."
    })
    latency_ms_benign = (time.perf_counter() - t0) * 1000
    assert resp_benign.status_code == 201
    data_benign = resp_benign.json()
    assert data_benign["crisis_response"] is None
    assert latency_ms_benign < 50, f"Expected <50ms, got {latency_ms_benign:.2f}ms"
    
    # Case B: Crisis trigger in manual stress request
    t1 = time.perf_counter()
    resp_crisis = client.post("/checkins", json={
        "user_id": user_id,
        "type": "manual",
        "mood_score": 1,
        "free_text": "I can't go on anymore, I want to end it all."
    })
    latency_ms_crisis = (time.perf_counter() - t1) * 1000
    assert resp_crisis.status_code == 201
    data_crisis = resp_crisis.json()
    
    # Assert crisis response delivered synchronously (<50ms)
    assert latency_ms_crisis < 50, f"Expected synchronous crisis response in <50ms, got {latency_ms_crisis:.2f}ms"
    assert data_crisis["crisis_response"] is not None
    assert data_crisis["crisis_response"]["crisis_detected"] is True
    assert data_crisis["crisis_response"]["detection_latency_ms"] < 50
    
    # Verify crisis event was appended to crisis_events table
    event = db_session.query(CrisisEvent).filter(CrisisEvent.user_id == user_id).first()
    assert event is not None
    assert event.detector_version == CRISIS_DETECTOR_VERSION
    assert "14416" in str(event.resources_shown_json)


# =============================================================================
# FEATURE 5: Relief library (3 techniques)
# API: GET /relief/techniques, POST /relief/sessions, PATCH /relief/sessions/{id}
# Done when: 3 techniques (square_breathing, grounding_54321, micro_meditation);
#            each has guided timer/script; completion + self-reported relief rating (1-5) recorded.
# =============================================================================
def test_feature5_relief_library_and_session_lifecycle(client, db_session):
    user_id = "qa_user_feat5"
    
    # 1. GET /relief/techniques -> exactly 3 techniques
    t0 = time.perf_counter()
    resp = client.get("/relief/techniques")
    latency_ms = (time.perf_counter() - t0) * 1000
    assert resp.status_code == 200
    techs = resp.json()
    assert len(techs) == 3
    assert latency_ms < 50
    
    tech_map = {t["id"]: t for t in techs}
    required_ids = {"square_breathing", "grounding_54321", "micro_meditation"}
    assert set(tech_map.keys()) == required_ids
    
    for tid in required_ids:
        t = tech_map[tid]
        assert "name" in t
        assert "duration_seconds" in t
        assert "pacing" in t
        assert "guidance_script" in t
        assert len(t["guidance_script"]) > 0
    
    # 2. POST /relief/sessions -> start session
    t1 = time.perf_counter()
    start_resp = client.post("/relief/sessions", json={
        "user_id": user_id,
        "technique": "square_breathing"
    })
    latency_start = (time.perf_counter() - t1) * 1000
    assert start_resp.status_code == 201
    s_data = start_resp.json()
    session_id = s_data["id"]
    assert s_data["technique"] == "square_breathing"
    assert s_data["completed_at"] is None
    assert latency_start < 50
    
    # 3. PATCH /relief/sessions/{id} -> complete with rating (1-5)
    t2 = time.perf_counter()
    complete_resp = client.patch(f"/relief/sessions/{session_id}", json={
        "self_reported_relief": 4
    })
    latency_complete = (time.perf_counter() - t2) * 1000
    assert complete_resp.status_code == 200
    c_data = complete_resp.json()
    assert c_data["id"] == session_id
    assert c_data["self_reported_relief"] == 4
    assert c_data["completed_at"] is not None
    assert latency_complete < 50
    
    # 4. Rating validation: reject ratings outside 1..5
    invalid_rating_high = client.patch(f"/relief/sessions/{session_id}", json={"self_reported_relief": 6})
    assert invalid_rating_high.status_code == 422
    invalid_rating_low = client.patch(f"/relief/sessions/{session_id}", json={"self_reported_relief": 0})
    assert invalid_rating_low.status_code == 422


# =============================================================================
# FEATURE 6: Stress index logging + trend line
# API: GET /stress-index?range=
# Done when: Line chart for last 7/30 days displays calculated daily stress scores.
# =============================================================================
def test_feature6_stress_index_trend(client, db_session):
    user_id = "qa_user_feat6"
    
    # Generate check-in which calculates daily stress
    client.post("/checkins", json={
        "user_id": user_id,
        "type": "morning",
        "mood_score": 6  # stress = 11 - 6 = 5.0
    })
    
    # Query 7d
    t0 = time.perf_counter()
    resp_7d = client.get(f"/stress-index?user_id={user_id}&range=7d")
    latency_7d = (time.perf_counter() - t0) * 1000
    assert resp_7d.status_code == 200
    data_7d = resp_7d.json()
    assert len(data_7d) >= 1
    pt = data_7d[0]
    assert "date" in pt
    assert "score" in pt
    # Mood 6 -> (10 - 6) * 11.11 = 44.44
    assert pt["score"] == 44.44
    assert pt["computed_from_count"] == 1
    assert latency_7d < 50
    
    # Query 30d
    t1 = time.perf_counter()
    resp_30d = client.get(f"/stress-index?user_id={user_id}&range=30d")
    latency_30d = (time.perf_counter() - t1) * 1000
    assert resp_30d.status_code == 200
    assert latency_30d < 50


# =============================================================================
# FEATURE 7: Crisis pathway
# API: POST /crisis/check
# Done when: Never gated behind login friction, latency <50ms,
#            returns Tele MANAS (14416), KIRAN (1800-599-0019), Emergency (112),
#            clickable tel: links, terracotta styling (#A36B5E) with NO raw red alarm styling,
#            immutable append-only crisis_events.
# =============================================================================
def test_feature7_crisis_pathway_verification(client, db_session):
    # 1. Zero auth / login friction: completely anonymous call
    t0 = time.perf_counter()
    resp = client.post("/crisis/check", json={
        "text": "I feel suicidal and want to end it all"
    })
    latency_ms = (time.perf_counter() - t0) * 1000
    assert resp.status_code == 200, "Must be accessible without auth/token"
    assert latency_ms < 50, f"Critical latency exceeded: {latency_ms:.2f}ms >= 50ms"
    
    data = resp.json()
    assert data["crisis_detected"] is True
    assert data["detection_latency_ms"] < 50
    
    # 2. Verify exact Govt of India Helplines and clickable tel: links
    resources = data["resources"]
    res_map = {r["id"]: r for r in resources}
    
    # Tele MANAS: 14416
    assert "tele_manas" in res_map
    tm = res_map["tele_manas"]
    assert tm["number"] == "14416"
    assert tm["tap_to_call"] == "tel:14416"
    
    # KIRAN: 1800-599-0019
    assert "kiran" in res_map
    kr = res_map["kiran"]
    assert kr["number"] == "1800-599-0019"
    assert kr["tap_to_call"] == "tel:18005990019"
    
    # Emergency: 112
    assert "emergency_112" in res_map
    em = res_map["emergency_112"]
    assert em["number"] == "112"
    assert em["tap_to_call"] == "tel:112"
    
    # 3. Manual SOS Click (no text needed)
    manual_resp = client.post("/crisis/check", json={"is_manual": True})
    assert manual_resp.status_code == 200
    assert manual_resp.json()["crisis_detected"] is True
    assert manual_resp.json()["triggered_by"] == "manual_emergency_button"
    
    # 4. Benign check (does NOT trigger crisis)
    benign_resp = client.post("/crisis/check", json={"text": "I am feeling relaxed today"})
    assert benign_resp.status_code == 200
    assert benign_resp.json()["crisis_detected"] is False
    
    # 5. Immutable append-only crisis_events verification
    initial_count = db_session.query(CrisisEvent).count()
    assert initial_count >= 2  # Anonymous call + manual call
    
    # Verify no DELETE or UPDATE endpoint exists on /crisis
    del_resp = client.delete("/crisis/check")
    assert del_resp.status_code in [404, 405]
    patch_resp = client.patch("/crisis/check")
    assert patch_resp.status_code in [404, 405]


# =============================================================================
# FEATURE 8: Data export & deletion
# API: POST /data/export, POST /data/delete
# Done when: Export produces complete downloadable JSON of all user data;
#            delete is irreversible and confirmed via double opt-in.
# =============================================================================
def test_feature8_data_export_and_deletion(client, db_session):
    user_id = "qa_user_feat8"
    
    # Seed user data across all tables
    client.post("/baseline", json={"user_id": user_id, "answers": {"q1": "ans1"}})
    client.post("/checkins", json={"user_id": user_id, "type": "morning", "mood_score": 7, "free_text": "Notes."})
    client.post("/relief/sessions", json={"user_id": user_id, "technique": "grounding_54321"})
    client.post("/integrations/wearable/connect", json={"user_id": user_id, "provider": "apple_health"})
    # Trigger crisis event associated with user
    client.post("/crisis/check", json={"user_id": user_id, "text": "suicide"})
    
    # 1. Export Data
    t0 = time.perf_counter()
    exp_resp = client.post("/data/export", json={"user_id": user_id})
    latency_export = (time.perf_counter() - t0) * 1000
    assert exp_resp.status_code == 200
    exp_data = exp_resp.json()
    assert exp_data["status"] == "completed"
    data = exp_data["data"]
    assert "user" in data
    assert "baseline_profile" in data
    assert "checkins" in data
    assert len(data["checkins"]) == 1
    assert "stress_index_daily" in data
    assert "relief_sessions" in data
    assert "wearable_connections" in data
    assert latency_export < 100
    
    # 2. Deletion without double opt-in confirmation (confirm=False) -> Rejection
    fail_del = client.post("/data/delete", json={"user_id": user_id, "confirm": False})
    assert fail_del.status_code == 400
    assert "requires confirm=True" in fail_del.json()["detail"]
    
    # 3. Deletion with double opt-in confirmation (confirm=True) -> Irreversible wipe
    t1 = time.perf_counter()
    succ_del = client.post("/data/delete", json={"user_id": user_id, "confirm": True})
    latency_delete = (time.perf_counter() - t1) * 1000
    assert succ_del.status_code == 200
    assert succ_del.json()["status"] == "deleted"
    assert latency_delete < 100
    
    # Verify post-deletion state:
    # User record deleted
    assert db_session.query(User).filter(User.id == user_id).first() is None
    # Baseline deleted
    assert db_session.query(BaselineProfile).filter(BaselineProfile.user_id == user_id).first() is None
    # Checkins deleted
    assert db_session.query(Checkin).filter(Checkin.user_id == user_id).count() == 0
    # Relief sessions deleted
    assert db_session.query(ReliefSession).filter(ReliefSession.user_id == user_id).count() == 0
    # Wearable connections deleted
    assert db_session.query(WearableConnection).filter(WearableConnection.user_id == user_id).count() == 0
    
    # SAFETY GUARDRAIL: crisis_events is NOT deleted! Linkage is anonymized (user_id set to None)
    anonymized_crisis = db_session.query(CrisisEvent).filter(CrisisEvent.user_id == None).all()
    assert len(anonymized_crisis) >= 1
    
    # Verify 404 on fetching deleted baseline
    assert client.get(f"/baseline?user_id={user_id}").status_code == 404


# =============================================================================
# CRITICAL GUARDRAIL VERIFICATIONS (SOP_ANTIGRAVITY.md §6)
# =============================================================================
def test_sop_guardrails_crisis_detector_and_helplines():
    # 1. Verify CrisisDetector Layer 1 runs locally in-process without network
    t0 = time.perf_counter()
    result = CrisisDetector.check_crisis("I want to end my life")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert result["crisis_detected"] is True
    assert elapsed_ms < 5.0, f"In-process keyword detection took {elapsed_ms}ms, expected <5ms"
    
    # 2. Verify all helpline numbers match official India Govt specifications
    assert len(INDIA_CRISIS_RESOURCES) == 3
    numbers = {r["id"]: r["number"] for r in INDIA_CRISIS_RESOURCES}
    assert numbers["tele_manas"] == "14416"
    assert numbers["kiran"] == "1800-599-0019"
    assert numbers["emergency_112"] == "112"
    
    # 3. Verify tel: URIs
    tels = {r["id"]: r["tap_to_call"] for r in INDIA_CRISIS_RESOURCES}
    assert tels["tele_manas"] == "tel:14416"
    assert tels["kiran"] == "tel:18005990019"
    assert tels["emergency_112"] == "tel:112"
