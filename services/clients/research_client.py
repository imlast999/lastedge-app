"""
LastEdge App — Strategy Lab REST API Client
services/clients/research_client.py

Handles HTTP communication with the LastEdge Strategy Lab (port 8082).
Features:
- Configurable timeout (default: 2.0s)
- Graceful degradation: returns safe offline payloads when Strategy Lab is offline
"""

from __future__ import annotations

import os
import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

_DEFAULT_URL = os.getenv("STRATEGY_LAB_URL", "http://localhost:8082")
_DEFAULT_TIMEOUT = float(os.getenv("API_TIMEOUT_SECONDS", "2.0"))


class ResearchClient:
    """Client for querying LastEdge Strategy Lab REST API."""

    def __init__(self, base_url: str = _DEFAULT_URL, timeout: float = _DEFAULT_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _get(self, path: str) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LastEdgeAppClient/1.0"})
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
                return {"ok": False, "status_code": resp.status, "message": "Non-200 response"}
        except urllib.error.HTTPError as e:
            return {"ok": False, "status_code": e.code, "message": str(e), "offline": False}
        except Exception as e:
            logger.debug(f"[ResearchClient] Strategy Lab offline ({url}): {e}")
            return {
                "ok": False,
                "offline": True,
                "service": "LastEdge Strategy Lab",
                "message": "Strategy Lab is currently unreachable or offline.",
                "url": url,
            }

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json", "User-Agent": "LastEdgeAppClient/1.0"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return {"ok": False, "status_code": e.code, "message": str(e), "offline": False}
        except Exception as e:
            logger.debug(f"[ResearchClient] POST error to Strategy Lab ({url}): {e}")
            return {
                "ok": False,
                "offline": True,
                "service": "LastEdge Strategy Lab",
                "message": "Strategy Lab is currently unreachable or offline.",
            }

    def is_online(self) -> bool:
        """Checks if Strategy Lab is online."""
        res = self._get("/api/research/health")
        return res.get("ok") is True

    def get_status(self) -> Dict[str, Any]:
        """Gets Strategy Lab status and experiment count."""
        res = self._get("/api/research/status")
        if res.get("offline"):
            return {
                "ok": False,
                "online": False,
                "service": "LastEdge Strategy Lab",
                "status": "OFFLINE",
                "total_experiments": 0,
                "candidate_strategies_count": 0,
                "message": "Strategy Lab is offline. Start Strategy Lab on port 8082."
            }
        return res

    def get_experiments(self) -> Dict[str, Any]:
        """Gets list of backtest and exit research experiments."""
        res = self._get("/api/research/experiments")
        if res.get("offline"):
            return {"ok": False, "experiments": [], "total": 0, "offline": True}
        return res

    def get_candidates(self) -> Dict[str, Any]:
        """Gets validated candidate strategies eligible for promotion."""
        res = self._get("/api/research/candidates")
        if res.get("offline"):
            return {"ok": False, "candidates": [], "count": 0, "offline": True}
        return res

    def promote_candidate(self, candidate_id: str, approver: str = "Architect") -> Dict[str, Any]:
        """Promotes a candidate strategy to production."""
        return self._post("/api/research/promote", {"candidate_id": candidate_id, "approver": approver})


_research_client: Optional[ResearchClient] = None


def get_research_client(base_url: Optional[str] = None) -> ResearchClient:
    global _research_client
    if _research_client is None or base_url is not None:
        _research_client = ResearchClient(base_url=base_url or _DEFAULT_URL)
    return _research_client
