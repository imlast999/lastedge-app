import pytest
from services.clients.trading_client import TradingClient


def test_trading_client_graceful_offline():
    # Connect to non-existent port to test offline handling
    client = TradingClient(base_url="http://localhost:59999", timeout=0.5)

    assert client.is_online() is False

    status = client.get_status()
    assert status.get("ok") is False
    assert status.get("online") is False
    assert status.get("status") == "OFFLINE"
    assert "offline" in status.get("message", "").lower()

    metrics = client.get_metrics()
    assert metrics.get("ok") is False
    assert metrics["metrics"]["offline"] is True

    positions = client.get_positions()
    assert positions.get("ok") is False
    assert positions["positions"] == []

    equity = client.get_equity()
    assert equity.get("ok") is False
    assert equity["equity"]["balance"] == 0.0
