"""Tests for Wearable Mock Integrations API (IMPLEMENTATION_PLAN.md Phase 1)."""
import pytest

def test_wearable_connection_flow(client):
    user_id = "test_user_wearable_flow"

    # Initially status is not connected
    status_initial = client.get(f"/integrations/wearable/status?user_id={user_id}")
    assert status_initial.status_code == 200
    assert status_initial.json()["connected"] is False
    assert len(status_initial.json()["connections"]) == 0

    # Connect Fitbit
    connect_res = client.post("/integrations/wearable/connect", json={
        "user_id": user_id,
        "provider": "fitbit"
    })
    assert connect_res.status_code == 200
    data = connect_res.json()
    assert data["provider"] == "fitbit"
    assert data["is_active"] is True
    assert data["connected_at"] is not None

    # Check status now shows connected
    status_after = client.get(f"/integrations/wearable/status?user_id={user_id}")
    assert status_after.status_code == 200
    assert status_after.json()["connected"] is True
    assert len(status_after.json()["connections"]) == 1

def test_wearable_invalid_provider(client):
    res = client.post("/integrations/wearable/connect", json={
        "user_id": "demo_user",
        "provider": "unknown_smartwatch_brand"
    })
    assert res.status_code == 400
    assert "invalid provider" in res.json()["detail"].lower()

def test_wearable_multiple_providers(client):
    user_id = "test_user_multi_wearable"

    # Connect Apple Health
    r1 = client.post("/api/v1/integrations/wearable/connect", json={"user_id": user_id, "provider": "apple_health"})
    assert r1.status_code == 200

    # Connect Google Fit
    r2 = client.post("/api/v1/integrations/wearable/connect", json={"user_id": user_id, "provider": "google_fit"})
    assert r2.status_code == 200

    status_res = client.get(f"/api/v1/integrations/wearable/status?user_id={user_id}")
    assert status_res.status_code == 200
    assert status_res.json()["connected"] is True
    assert len(status_res.json()["connections"]) == 2
