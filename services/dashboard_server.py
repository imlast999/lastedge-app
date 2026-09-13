"""
LastEdge App — Decoupled Web Dashboard Server
services/dashboard_server.py

Serves the Web Dashboard UI on port 8080 and proxies telemetry & command requests
to LastEdge Trading Engine (port 8081) and Strategy Lab (port 8082) via decoupled
HTTP REST clients.

Architectural Guarantees:
- Zero imports from Trading Engine or Strategy Lab internal code.
- Graceful Degradation: Starts and remains responsive even if backend engines are offline.
"""

from __future__ import annotations

import os
import sys
import json
import logging
import threading
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from typing import Optional, Dict, Any

from services.clients.trading_client import get_trading_client
from services.clients.research_client import get_research_client

logger = logging.getLogger(__name__)


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


class AppDashboardHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for LastEdge App Dashboard."""

    def _send_json(self, status_code: int, data: Any):
        try:
            body = json.dumps(data, indent=2, default=str).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionAbortedError, BrokenPipeError, OSError):
            pass
        except Exception as e:
            logger.error("Error writing JSON response: %s", e)

    def _serve_static_file(self, filepath: Path):
        try:
            if not filepath.exists() or not filepath.is_file():
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"404 Not Found")
                return

            mime_type, _ = mimetypes.guess_type(str(filepath))
            mime_type = mime_type or "application/octet-stream"

            with open(filepath, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            logger.error("Error serving static file %s: %s", filepath, e)
            self.send_response(500)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        trading_client = get_trading_client()
        research_client = get_research_client()

        try:
            # ── App Health & Overview (Parallel Probes) ───────────────────────
            if path in ("/api/app/health", "/api/health", "/health"):
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor(max_workers=2) as executor:
                    fut_t = executor.submit(trading_client.is_online)
                    fut_r = executor.submit(research_client.is_online)
                    t_online = fut_t.result()
                    r_online = fut_r.result()

                self._send_json(200, {
                    "ok": True,
                    "service": "LastEdge App & Dashboard",
                    "status": "ONLINE",
                    "trading_engine_online": t_online,
                    "strategy_lab_online": r_online,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            elif path in ("/api/status", "/api/system/status"):
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor(max_workers=2) as executor:
                    fut_t = executor.submit(trading_client.get_status)
                    fut_r = executor.submit(research_client.get_status)
                    t_stat = fut_t.result()
                    r_stat = fut_r.result()

                self._send_json(200, {
                    "ok": True,
                    "app": "LastEdge Control App",
                    "trading_engine": t_stat,
                    "strategy_lab": r_stat,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            # ── Unified Ecosystem Aggregated Payload ──────────────────────────
            elif path in ("/api/data", "/api/dashboard/data"):
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor(max_workers=6) as ex:
                    f_status = ex.submit(trading_client.get_status)
                    f_metrics = ex.submit(trading_client.get_metrics)
                    f_equity = ex.submit(trading_client.get_equity)
                    f_pos = ex.submit(trading_client.get_positions)
                    f_risk = ex.submit(trading_client.get_risk)
                    f_signals = ex.submit(trading_client.get_signals)
                    f_checklist = ex.submit(trading_client.get_checklist)
                    f_exp = ex.submit(research_client.get_experiments)

                t_stat = f_status.result()
                t_metrics = f_metrics.result()
                t_equity = f_equity.result()
                t_pos = f_pos.result()
                t_risk = f_risk.result()
                t_sig = f_signals.result()
                t_check = f_checklist.result()
                r_exp = f_exp.result()

                self._send_json(200, {
                    "ok": True,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "trading_engine": t_stat,
                    "metrics": t_metrics.get("metrics", {}),
                    "equity": t_equity.get("equity", {}),
                    "positions": t_pos.get("positions", []),
                    "risk": t_risk,
                    "signals": t_sig.get("signals", []),
                    "checklist": t_check.get("checklist", {}),
                    "research": r_exp,
                })

            # ── Trading Engine Proxies ────────────────────────────────────────
            elif path in ("/api/metrics", "/api/trading/metrics"):
                self._send_json(200, trading_client.get_metrics())

            elif path in ("/api/positions", "/api/trading/positions"):
                self._send_json(200, trading_client.get_positions())

            elif path in ("/api/risk", "/api/trading/risk"):
                self._send_json(200, trading_client.get_risk())

            elif path in ("/api/equity", "/api/trading/equity"):
                self._send_json(200, trading_client.get_equity())

            elif path in ("/api/signals", "/api/trading/signals"):
                self._send_json(200, trading_client.get_signals())

            elif path in ("/api/checklist", "/api/trading/checklist"):
                self._send_json(200, trading_client.get_checklist())

            # ── Strategy Lab Proxies ──────────────────────────────────────────
            elif path in ("/api/research/experiments", "/api/experiments"):
                self._send_json(200, research_client.get_experiments())

            elif path in ("/api/research/candidates", "/api/candidates"):
                self._send_json(200, research_client.get_candidates())

            elif path in ("/api/research/status",):
                self._send_json(200, research_client.get_status())

            # ── Static UI Assets ──────────────────────────────────────────────
            else:
                base_dir = Path(__file__).parent.parent
                search_dirs = [base_dir / "dashboard", base_dir / "branding", base_dir / "static"]
                req_path = self.path.split("?")[0].lstrip("/")

                target_file = None
                for s_dir in search_dirs:
                    if not s_dir.exists():
                        continue
                    if not req_path or req_path == "dashboard":
                        cand = s_dir / "index.html"
                    else:
                        cand = s_dir / req_path
                    if cand.exists() and cand.is_file():
                        target_file = cand
                        break

                if target_file:
                    self._serve_static_file(target_file)
                else:
                    # Fallback to index.html if available in any search dir
                    index_found = False
                    for s_dir in search_dirs:
                        cand_index = s_dir / "index.html"
                        if cand_index.exists() and cand_index.is_file():
                            self._serve_static_file(cand_index)
                            index_found = True
                            break
                    if not index_found:
                        self._send_json(404, {"ok": False, "error": f"Path '{self.path}' not found."})

        except Exception as e:
            logger.error("Dashboard error handling GET %s: %s", self.path, e)
            self._send_json(500, {"ok": False, "error": str(e)})

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        trading_client = get_trading_client()
        research_client = get_research_client()

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body_data = {}
            if content_length > 0:
                raw_body = self.rfile.read(content_length).decode("utf-8")
                body_data = json.loads(raw_body) if raw_body else {}

            if path in ("/api/positions/close", "/api/trading/positions/close"):
                ticket = body_data.get("ticket")
                if ticket is None:
                    self._send_json(400, {"ok": False, "error": "Missing 'ticket' parameter."})
                    return
                res = trading_client.close_position(int(ticket))
                self._send_json(200 if res.get("ok") else 400, res)

            elif path in ("/api/research/promote", "/api/promote"):
                candidate_id = body_data.get("candidate_id")
                approver = body_data.get("approver", "Architect")
                if not candidate_id:
                    self._send_json(400, {"ok": False, "error": "Missing 'candidate_id' parameter."})
                    return
                res = research_client.promote_candidate(candidate_id, approver)
                self._send_json(200 if res.get("ok") else 400, res)

            else:
                self._send_json(404, {"ok": False, "error": f"POST endpoint '{self.path}' not found."})

        except Exception as e:
            logger.error("Dashboard error handling POST %s: %s", self.path, e)
            self._send_json(500, {"ok": False, "error": str(e)})

    def log_message(self, format, *args):
        pass


class AppDashboardServer:
    """Manages the background HTTP server for LastEdge App & Web Dashboard."""

    def __init__(self, host: str = "0.0.0.0", port: Optional[int] = None):
        self.host = host or os.getenv("APP_HOST", "0.0.0.0")
        self.port = port or int(os.getenv("APP_PORT", "8080"))
        self.server: Optional[ReusableThreadingHTTPServer] = None
        self.thread: Optional[threading.Thread] = None
        self.is_running = False
        self.lock = threading.Lock()

    def start(self):
        with self.lock:
            if self.is_running:
                return
            try:
                self.server = ReusableThreadingHTTPServer((self.host, self.port), AppDashboardHandler)
                self.is_running = True
                self.thread = threading.Thread(target=self.server.serve_forever, daemon=True, name="AppDashboardServer")
                self.thread.start()
                logger.info("[App Dashboard] Server running on http://%s:%d", self.host, self.port)
            except Exception as e:
                logger.error("[App Dashboard] Failed to start server on port %d: %s", self.port, e)

    def stop(self):
        with self.lock:
            if not self.is_running or not self.server:
                return
            self.is_running = False
            try:
                self.server.shutdown()
                self.server.server_close()
                logger.info("[App Dashboard] Server stopped.")
            except Exception as e:
                logger.debug("[App Dashboard] Error during shutdown: %s", e)


_dashboard_server_instance: Optional[AppDashboardServer] = None


def get_dashboard_server(port: Optional[int] = None) -> AppDashboardServer:
    global _dashboard_server_instance
    if _dashboard_server_instance is None:
        _dashboard_server_instance = AppDashboardServer(port=port)
    return _dashboard_server_instance


def start_dashboard_server(port: Optional[int] = None) -> AppDashboardServer:
    srv = get_dashboard_server(port=port)
    srv.start()
    return srv


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s")
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.getenv("APP_PORT", "8080"))
    srv = start_dashboard_server(port=port)
    print(f"LastEdge App Dashboard running on http://localhost:{port}. Press Ctrl+C to stop.")
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        srv.stop()
