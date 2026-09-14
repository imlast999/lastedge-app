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

_DEFAULT_URL = os.getenv("STRATEGY_LAB_URL", "http://127.0.0.1:8082")
_DEFAULT_TIMEOUT = float(os.getenv("API_TIMEOUT_SECONDS", "2.5"))


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
        res = self._get("/")
        if res.get("ok") is True:
            return True
        res_health = self._get("/api/research/health")
        return res_health.get("ok") is True

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

    def run_backtest(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Runs a quantitative backtest simulation on Strategy Lab with extended timeout."""
        url = f"{self.base_url}/api/research/backtest"
        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json", "User-Agent": "LastEdgeAppClient/1.0"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=60.0) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                err_json = json.loads(e.read().decode("utf-8"))
                return err_json
            except Exception:
                return {"ok": False, "status_code": e.code, "message": str(e)}
        except Exception as e:
            logger.error(f"[ResearchClient] run_backtest error ({url}): {e}")
            return {
                "ok": False,
                "offline": True,
                "message": f"Strategy Lab failed to execute backtest: {e}"
            }

    def get_strategies(self) -> Dict[str, Any]:
        """Gets available strategies registry from Strategy Lab with resilient fallback."""
        res = self._get("/api/research/strategies")
        if res.get("offline"):
            return {
                "ok": False,
                "offline": True,
                "symbols": ["EURUSD", "XAUUSD", "BTCEUR"],
                "strategies": {
                    "EURUSD": [
                        {
                            "id": "eurusd_partial",
                            "name": "EURUSD Partial Close (v1.1)",
                            "description": "Trend momentum with EMA20/50/200, RSI and dynamic ATR partial closes",
                            "allowed_timeframes": ["H1"],
                            "default_timeframe": "H1",
                        }
                    ],
                    "XAUUSD": [
                        {
                            "id": "xauusd_partial",
                            "name": "XAUUSD Partial Close (v1.1)",
                            "description": "Selective Gold momentum reversal with multi-stage partial TP",
                            "allowed_timeframes": ["H1"],
                            "default_timeframe": "H1",
                        },
                        {
                            "id": "xauusd_simple",
                            "name": "XAUUSD Simple Baseline",
                            "description": "Gold trend baseline with EMA200 trend filter and RSI momentum",
                            "allowed_timeframes": ["H1"],
                            "default_timeframe": "H1",
                        }
                    ],
                    "BTCEUR": [
                        {
                            "id": "btceur_partial",
                            "name": "BTCEUR Partial Close (v1.1)",
                            "description": "Simplified Bitcoin trend & volatility with partial take profit",
                            "allowed_timeframes": ["H1"],
                            "default_timeframe": "H1",
                        },
                        {
                            "id": "btceur_simple",
                            "name": "BTCEUR Simple Baseline",
                            "description": "Baseline trend & volatility breakout for Bitcoin EUR",
                            "allowed_timeframes": ["H1"],
                            "default_timeframe": "H1",
                        },
                        {
                            "id": "btc_trend_pullback_v1",
                            "name": "BTC Trend Pullback v1",
                            "description": "Swing trading combining H4 macro trend filter with H1 EMA20 pullbacks",
                            "allowed_timeframes": ["H1"],
                            "default_timeframe": "H1",
                        },
                        {
                            "id": "btceur_regime_momentum",
                            "name": "BTCEUR Regime Momentum",
                            "description": "Daily regime filter (EMA50>200, ADX>20) + H4 Donchian breakout (Long only)",
                            "allowed_timeframes": ["H4"],
                            "default_timeframe": "H4",
                        },
                        {
                            "id": "btceur_weekly_breakout",
                            "name": "BTCEUR Weekly Breakout",
                            "description": "Weekly range breakout capturing institutional weekly expansion waves",
                            "allowed_timeframes": ["H1"],
                            "default_timeframe": "H1",
                        }
                    ]
                }
            }
        return res



_research_client: Optional[ResearchClient] = None


def get_research_client(base_url: Optional[str] = None) -> ResearchClient:
    global _research_client
    if _research_client is None or base_url is not None:
        _research_client = ResearchClient(base_url=base_url or _DEFAULT_URL)
    return _research_client
