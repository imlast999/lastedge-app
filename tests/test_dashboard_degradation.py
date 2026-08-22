import json
import time
import urllib.request
import pytest
from services.dashboard_server import AppDashboardServer


def test_dashboard_server_starts_and_handles_offline_backends():
    """
    Verifies that LastEdge App Dashboard server starts successfully on its port,
    serves health & overview telemetry, and degrades gracefully when Trading Engine
    and Strategy Lab are completely offline.
    """
    port = 8893
    server = AppDashboardServer(port=port)
    server.start()
    time.sleep(0.3)

    try:
        # 1. Health check
        req = urllib.request.urlopen(f"http://localhost:{port}/api/health")
        assert req.status == 200
        data = json.loads(req.read().decode("utf-8"))
        assert data.get("ok") is True
        assert data.get("service") == "LastEdge App & Dashboard"
        assert data.get("trading_engine_online") is False
        assert data.get("strategy_lab_online") is False

        # 2. System status overview (shows offline gracefully)
        req_status = urllib.request.urlopen(f"http://localhost:{port}/api/status")
        assert req_status.status == 200
        status_data = json.loads(req_status.read().decode("utf-8"))
        assert status_data.get("ok") is True
        assert status_data["trading_engine"]["status"] == "OFFLINE"
        assert status_data["strategy_lab"]["status"] == "OFFLINE"

        # 3. Proxied endpoints degrade safely
        req_pos = urllib.request.urlopen(f"http://localhost:{port}/api/positions")
        assert req_pos.status == 200
        pos_data = json.loads(req_pos.read().decode("utf-8"))
        assert pos_data.get("positions") == []

        req_exp = urllib.request.urlopen(f"http://localhost:{port}/api/research/experiments")
        assert req_exp.status == 200
        exp_data = json.loads(req_exp.read().decode("utf-8"))
        assert exp_data.get("experiments") == []

    finally:
        server.stop()
        time.sleep(0.2)
