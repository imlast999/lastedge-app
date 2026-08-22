import pytest
from services.clients.research_client import ResearchClient


def test_research_client_graceful_offline():
    # Connect to non-existent port to test offline handling
    client = ResearchClient(base_url="http://localhost:59998", timeout=0.5)

    assert client.is_online() is False

    status = client.get_status()
    assert status.get("ok") is False
    assert status.get("online") is False
    assert status.get("status") == "OFFLINE"
    assert "offline" in status.get("message", "").lower()

    experiments = client.get_experiments()
    assert experiments.get("ok") is False
    assert experiments["experiments"] == []

    candidates = client.get_candidates()
    assert candidates.get("ok") is False
    assert candidates["candidates"] == []
