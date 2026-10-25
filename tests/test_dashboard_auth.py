import json
import os
import time
import urllib.request
import urllib.error
import pytest
from services.dashboard_server import AppDashboardServer


def test_dashboard_auth_verify_and_status(monkeypatch):
    """
    Verifies that /api/auth/verify:
    - Responds HTTP 200 with valid token when the correct PIN is provided.
    - Responds HTTP 401 when an invalid PIN is provided.
    - Dynamically reflects changes to DASHBOARD_PIN environment variable.
    - Verifies /api/auth/status token validation.
    """
    monkeypatch.setenv("DASHBOARD_PIN", "1623")

    port = 8894
    server = AppDashboardServer(port=port)
    server.start()
    time.sleep(0.3)

    try:
        # 1. Test correct PIN (1623) -> 200 OK
        payload = json.dumps({"pin": "1623"}).encode("utf-8")
        req = urllib.request.Request(
            f"http://localhost:{port}/api/auth/verify",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode("utf-8"))
            assert data.get("ok") is True
            assert data.get("token") == "lastedge_auth_valid"
            assert "Access granted" in data.get("message", "")

        # 2. Test incorrect PIN (9999) -> 401 Unauthorized
        bad_payload = json.dumps({"pin": "9999"}).encode("utf-8")
        bad_req = urllib.request.Request(
            f"http://localhost:{port}/api/auth/verify",
            data=bad_payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with pytest.raises(urllib.error.HTTPError) as exc_info:
            urllib.request.urlopen(bad_req)
        assert exc_info.value.code == 401
        err_data = json.loads(exc_info.value.read().decode("utf-8"))
        assert err_data.get("ok") is False
        assert err_data.get("error") == "Invalid PIN"

        # 3. Test dynamic DASHBOARD_PIN env variable override
        monkeypatch.setenv("DASHBOARD_PIN", "4321")
        new_payload = json.dumps({"pin": "4321"}).encode("utf-8")
        new_req = urllib.request.Request(
            f"http://localhost:{port}/api/auth/verify",
            data=new_payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(new_req) as resp:
            assert resp.status == 200
            new_data = json.loads(resp.read().decode("utf-8"))
            assert new_data.get("ok") is True
            assert new_data.get("token") == "lastedge_auth_valid"

        # 4. Test /api/auth/status
        # 4a. Without token
        req_status = urllib.request.urlopen(f"http://localhost:{port}/api/auth/status")
        assert req_status.status == 200
        status_data = json.loads(req_status.read().decode("utf-8"))
        assert status_data.get("ok") is True
        assert status_data.get("authenticated") is False

        # 4b. With Bearer token
        req_auth_status = urllib.request.Request(
            f"http://localhost:{port}/api/auth/status",
            headers={"Authorization": "Bearer lastedge_auth_valid"}
        )
        with urllib.request.urlopen(req_auth_status) as resp:
            assert resp.status == 200
            auth_data = json.loads(resp.read().decode("utf-8"))
            assert auth_data.get("ok") is True
            assert auth_data.get("authenticated") is True

    finally:
        server.stop()
