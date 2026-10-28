"""
LastEdge App — Trading Engine REST API Client
services/clients/trading_client.py

Handles HTTP communication with the LastEdge Trading Engine (port 8081).
Features:
- Configurable timeout (default: 2.0s)
- Graceful degradation: returns safe offline payloads when Trading Engine is not reachable
- Zero crashes if backend is stopped
"""

from __future__ import annotations

import os
import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

_DEFAULT_URL = os.getenv("TRADING_ENGINE_URL", "http://127.0.0.1:8081")
_DEFAULT_TIMEOUT = float(os.getenv("API_TIMEOUT_SECONDS", "2.5"))


class TradingClient:
    """Client for querying LastEdge Trading Engine REST API."""

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
            logger.debug(f"[TradingClient] Trading Engine offline ({url}): {e}")
            return {
                "ok": False,
                "offline": True,
                "service": "LastEdge Trading Engine",
                "message": "Trading Engine is currently unreachable or offline.",
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
            try:
                body = e.read().decode("utf-8")
                parsed = json.loads(body)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass
            return {"ok": False, "status_code": e.code, "message": str(e), "offline": False}
        except Exception as e:
            logger.debug(f"[TradingClient] POST error to Trading Engine ({url}): {e}")
            return {
                "ok": False,
                "offline": True,
                "service": "LastEdge Trading Engine",
                "message": "Trading Engine is currently unreachable or offline.",
            }

    def is_online(self) -> bool:
        """Checks if Trading Engine is online and responsive."""
        res = self._get("/")
        if res.get("ok") is True:
            return True
        res_health = self.get_health()
        return res_health.get("ok") is True

    def get_health(self) -> Dict[str, Any]:
        """Gets Trading Engine health metrics."""
        return self._get("/api/trading/health")

    def get_execution_analytics(self) -> Dict[str, Any]:
        """Gets execution quality and slippage analytics."""
        res = self._get("/api/trading/execution-analytics")
        if res.get("offline"):
            return {"ok": False, "analytics": {}, "offline": True}
        return res

    def get_status(self) -> Dict[str, Any]:
        """Gets Trading Engine general status, uptime, and state."""
        res = self._get("/api/trading/status")
        if res.get("offline"):
            return {
                "ok": False,
                "online": False,
                "service": "LastEdge Trading Engine",
                "status": "OFFLINE",
                "uptime": "0h 0m",
                "mt5_connected": False,
                "message": "Trading Engine is offline. Start Trading Engine on port 8081."
            }
        return res

    def get_metrics(self) -> Dict[str, Any]:
        """Gets high-level operational metrics and account state."""
        res = self._get("/api/trading/metrics")
        if res.get("offline"):
            return {
                "ok": False,
                "metrics": {
                    "balance": 0.0,
                    "equity": 0.0,
                    "signals_today": 0,
                    "trades_today": 0,
                    "win_rate": 0.0,
                    "offline": True,
                }
            }
        return res

    def get_positions(self) -> Dict[str, Any]:
        """Gets active open positions in MT5."""
        res = self._get("/api/trading/positions")
        if res.get("offline"):
            return {"ok": False, "positions": [], "offline": True}
        return res

    def get_equity(self) -> Dict[str, Any]:
        """Gets account equity, margin, and balance metrics."""
        res = self._get("/api/trading/equity")
        if res.get("offline"):
            return {
                "ok": False,
                "equity": {
                    "balance": 0.0,
                    "equity": 0.0,
                    "margin": 0.0,
                    "free_margin": 0.0,
                    "floating_pnl": 0.0,
                    "offline": True,
                }
            }
        return res

    def get_signals(self) -> Dict[str, Any]:
        """Gets today's signal history."""
        res = self._get("/api/trading/signals")
        if res.get("offline"):
            return {"ok": False, "signals": [], "offline": True}
        return res

    def get_checklist(self) -> Dict[str, Any]:
        """Gets production readiness go-live checklist."""
        res = self._get("/api/trading/checklist")
        if res.get("offline"):
            return {"ok": False, "checklist": {}, "offline": True}
        return res

    def get_risk(self) -> Dict[str, Any]:
        """Gets real-time Risk Engine v2 telemetry and circuit breaker state."""
        res = self._get("/api/trading/risk")
        if res.get("offline"):
            return {
                "ok": False,
                "can_trade": False,
                "circuit_breaker": {"can_trade": False, "reason": "Trading Engine offline"},
                "open_positions_count": 0,
                "total_exposure_lots": 0.0,
                "total_floating_pnl": 0.0,
                "account_equity": 0.0,
                "offline": True
            }
        return res

    def close_position(self, ticket: int) -> Dict[str, Any]:
        """Requests closing an open MT5 position."""
        return self._post("/api/trading/positions/close", {"ticket": ticket})

    def approve_signal(self, signal_id: int, force: bool = False) -> Dict[str, Any]:
        """Approves and executes a proposed signal on Trading Engine with optional slippage bypass."""
        return self._post("/api/trading/signals/approve", {"signal_id": signal_id, "force": force})

    def reject_signal(self, signal_id: int) -> Dict[str, Any]:
        """Discards / rejects a proposed signal on Trading Engine."""
        return self._post("/api/trading/signals/reject", {"signal_id": signal_id})

    def toggle_autosignals(self, mode: str = "status") -> Dict[str, Any]:
        """Toggles or queries AutoSignals state."""
        return self._post("/api/trading/autosignals", {"mode": mode})

    def get_autonomous_mode(self) -> Dict[str, Any]:
        """Gets current 100% Autonomous (Hands-Free) mode status."""
        res = self._get("/api/trading/autonomous-mode")
        if res.get("offline"):
            return {"ok": False, "autonomous_mode": True, "offline": True}
        return res

    def set_autonomous_mode(self, enabled=None, mode=None) -> Dict[str, Any]:
        """Sets or toggles 100% Autonomous mode on Trading Engine."""
        payload = {}
        if enabled is not None:
            payload["enabled"] = bool(enabled)
        if mode is not None:
            payload["mode"] = mode
        return self._post("/api/trading/autonomous-mode", payload)

    def get_equity_history(self, days: int = 30) -> Dict[str, Any]:
        """Gets real historical balance and equity curve data from Trading Engine."""
        res = self._get(f"/api/trading/equity/history?days={days}")
        if res.get("offline"):
            return {"ok": False, "history": [], "offline": True}
        return res

    def get_strategy_radar(self, symbol: str = "XAUUSD") -> Dict[str, Any]:
        """Gets live strategy evaluation condition radar telemetry."""
        res = self._get(f"/api/trading/radar?symbol={symbol}")
        if res.get("offline"):
            return {
                "ok": False,
                "symbol": symbol,
                "readiness_pct": 0,
                "overall_status": "OFFLINE",
                "conditions": [],
                "offline": True
            }
        return res


_trading_client: Optional[TradingClient] = None


def get_trading_client(base_url: Optional[str] = None) -> TradingClient:
    global _trading_client
    if _trading_client is None or base_url is not None:
        _trading_client = TradingClient(base_url=base_url or _DEFAULT_URL)
    return _trading_client
