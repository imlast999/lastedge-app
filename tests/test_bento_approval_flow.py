"""
Tests para el Flujo de Aprobación Web3 Bento y Callbacks de Telegram
(LastEdge App/tests/test_bento_approval_flow.py)
====================================================================
Valida:
1. Callbacks interactivos de Telegram (appr_, rejc_, force_) procesados por TelegramAdapter.
2. Endpoints proxy de aprobación y descarte en AppDashboardServer (POST /api/signals/approve y /reject).
"""

import json
import socket
import time
import urllib.request
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from services.telegram_adapter import TelegramAdapter
from services.dashboard_server import AppDashboardServer


class TestTelegramInteractiveCallbacks(unittest.IsolatedAsyncioTestCase):
    """Pruebas unitarias para los callbacks interactivos de Telegram (appr_, rejc_, force_)."""

    def setUp(self):
        self.bot_service = MagicMock()
        self.trading_client = MagicMock()
        self.research_client = MagicMock()

        self.adapter = TelegramAdapter(
            bot_service=self.bot_service,
            trading_client=self.trading_client,
            research_client=self.research_client
        )
        self.adapter.token = "TEST_TOKEN_1234"
        self.adapter.authorized_chat_id = "12345"
        self.adapter.authorized_user_id = None  # Permitir todos en prueba o None

    def _create_mock_session(self):
        mock_session = MagicMock()
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='{"ok": true}')

        mock_post = MagicMock()
        mock_post.__aenter__ = AsyncMock(return_value=mock_response)
        mock_post.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = MagicMock(return_value=mock_post)
        return mock_session

    async def test_callback_approve_success(self):
        """Simular callback de aprobación (appr_101) ejecutado limpiamente sin desviación."""
        mock_session = self._create_mock_session()
        self.trading_client.approve_signal.return_value = {
            "ok": True,
            "ticket": 987654,
            "executed_price": 2745.50
        }

        cq = {
            "id": "cq_appr_1",
            "data": "appr_101",
            "message": {
                "chat": {"id": 12345},
                "message_id": 555
            },
            "from": {"id": 12345}
        }

        with patch.object(self.adapter, "_edit_message_text", new_callable=AsyncMock) as mock_edit:
            await self.adapter._process_callback_query(mock_session, cq)

            # Verificar que invoca al trading_client con force=False
            self.trading_client.approve_signal.assert_called_once_with(101, force=False)

            # Verificar edición de mensaje en Telegram informando ejecución
            mock_edit.assert_called_once()
            call_args = mock_edit.call_args
            assert "987654" in call_args[0][3]
            assert "ORDEN EJECUTADA EN MT5" in call_args[0][3]

    async def test_callback_approve_price_drift(self):
        """Simular callback de aprobación (appr_101) con detección de deslizamiento (PRICE_DRIFT)."""
        mock_session = self._create_mock_session()
        self.trading_client.approve_signal.return_value = {
            "ok": False,
            "error": "PRICE_DRIFT",
            "signal_price": 2740.0,
            "current_price": 2752.0,
            "drift_pips": 12.0
        }

        cq = {
            "id": "cq_drift_1",
            "data": "appr_101",
            "message": {
                "chat": {"id": 12345},
                "message_id": 555
            },
            "from": {"id": 12345}
        }

        with patch.object(self.adapter, "_edit_message_text", new_callable=AsyncMock) as mock_edit:
            await self.adapter._process_callback_query(mock_session, cq)

            self.trading_client.approve_signal.assert_called_once_with(101, force=False)
            mock_edit.assert_called_once()
            args, kwargs = mock_edit.call_args
            edited_text = args[3]
            reply_markup = kwargs.get("reply_markup") or {}

            # Debe avisar sobre desviación de precio
            assert "ALERTA DE DESVIACIÓN DE PRECIO" in edited_text
            assert "2740.0" in edited_text
            assert "2752.0" in edited_text

            # Debe ofrecer botones de forzar a mercado (force_101) o cancelar (rejc_101)
            ik = reply_markup.get("inline_keyboard", [])
            assert len(ik) > 0
            all_callbacks = [btn.get("callback_data") for row in ik for btn in row]
            assert "force_101" in all_callbacks
            assert "rejc_101" in all_callbacks

    async def test_callback_reject(self):
        """Simular callback de rechazo (rejc_101)."""
        mock_session = self._create_mock_session()
        self.trading_client.reject_signal.return_value = {
            "ok": True,
            "status": "REJECTED_MANUAL",
            "signal_id": 101
        }

        cq = {
            "id": "cq_rejc_1",
            "data": "rejc_101",
            "message": {
                "chat": {"id": 12345},
                "message_id": 555
            },
            "from": {"id": 12345}
        }

        with patch.object(self.adapter, "_edit_message_text", new_callable=AsyncMock) as mock_edit:
            await self.adapter._process_callback_query(mock_session, cq)

            self.trading_client.reject_signal.assert_called_once_with(101)
            mock_edit.assert_called_once()
            args, kwargs = mock_edit.call_args
            edited_text = args[3]
            assert "SEÑAL DESCARTADA MANUALMENTE" in edited_text

    async def test_callback_force_execute(self):
        """Simular callback de ejecución forzada tras desviación de precio (force_101)."""
        mock_session = self._create_mock_session()
        self.trading_client.approve_signal.return_value = {
            "ok": True,
            "ticket": 987655,
            "executed_price": 2752.0
        }

        cq = {
            "id": "cq_force_1",
            "data": "force_101",
            "message": {
                "chat": {"id": 12345},
                "message_id": 555
            },
            "from": {"id": 12345}
        }

        with patch.object(self.adapter, "_edit_message_text", new_callable=AsyncMock) as mock_edit:
            await self.adapter._process_callback_query(mock_session, cq)

            self.trading_client.approve_signal.assert_called_once_with(101, force=True)
            mock_edit.assert_called_once()
            args, kwargs = mock_edit.call_args
            edited_text = args[3]
            assert "ORDEN EJECUTADA EN MT5" in edited_text
            assert "987655" in edited_text


class TestDashboardServerApprovalProxy(unittest.TestCase):
    """Pruebas para el proxy de aprobación y descarte en AppDashboardServer."""

    @classmethod
    def setUpClass(cls):
        # Encontrar un puerto libre
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("", 0))
            cls.port = s.getsockname()[1]

        cls.mock_trading_client = MagicMock()
        cls.patcher = patch("services.dashboard_server.get_trading_client", return_value=cls.mock_trading_client)
        cls.patcher.start()

        cls.server = AppDashboardServer(port=cls.port)
        cls.server.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        cls.patcher.stop()
        time.sleep(0.2)

    def setUp(self):
        self.mock_trading_client.reset_mock()

    def test_proxy_approve_signal_standard(self):
        """POST /api/signals/approve envía la solicitud a Trading Engine sin flag force."""
        self.mock_trading_client.approve_signal.return_value = {
            "ok": True,
            "ticket": 123456,
            "executed_price": 2740.0
        }

        payload = json.dumps({"signal_id": 202, "force": False}).encode("utf-8")
        req = urllib.request.Request(
            f"http://localhost:{self.port}/api/signals/approve",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode("utf-8"))
            assert data["ok"] is True
            assert data["ticket"] == 123456

        self.mock_trading_client.approve_signal.assert_called_once_with(202, force=False)

    def test_proxy_approve_signal_price_drift(self):
        """POST /api/signals/approve devuelve 200 con payload PRICE_DRIFT para modal de confirmación."""
        self.mock_trading_client.approve_signal.return_value = {
            "ok": False,
            "error": "PRICE_DRIFT",
            "signal_price": 2740.0,
            "current_price": 2755.0,
            "drift_pips": 15.0
        }

        payload = json.dumps({"signal_id": 202, "force": False}).encode("utf-8")
        req = urllib.request.Request(
            f"http://localhost:{self.port}/api/signals/approve",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode("utf-8"))
            assert data["ok"] is False
            assert data["error"] == "PRICE_DRIFT"

        self.mock_trading_client.approve_signal.assert_called_once_with(202, force=False)

    def test_proxy_approve_signal_forced(self):
        """POST /api/signals/approve con force=True ejecuta ignorando la desviación."""
        self.mock_trading_client.approve_signal.return_value = {
            "ok": True,
            "ticket": 123457,
            "executed_price": 2755.0
        }

        payload = json.dumps({"signal_id": 202, "force": True}).encode("utf-8")
        req = urllib.request.Request(
            f"http://localhost:{self.port}/api/signals/approve",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode("utf-8"))
            assert data["ok"] is True
            assert data["ticket"] == 123457

        self.mock_trading_client.approve_signal.assert_called_once_with(202, force=True)

    def test_proxy_reject_signal(self):
        """POST /api/signals/reject descarta la señal y responde 200."""
        self.mock_trading_client.reject_signal.return_value = {
            "ok": True,
            "status": "REJECTED_MANUAL",
            "signal_id": 202
        }

        payload = json.dumps({"signal_id": 202}).encode("utf-8")
        req = urllib.request.Request(
            f"http://localhost:{self.port}/api/signals/reject",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode("utf-8"))
            assert data["ok"] is True
            assert data["status"] == "REJECTED_MANUAL"

        self.mock_trading_client.reject_signal.assert_called_once_with(202)
