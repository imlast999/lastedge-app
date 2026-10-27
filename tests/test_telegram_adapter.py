"""
Tests para TelegramAdapter y NotificationDispatcher (tests/test_telegram_adapter.py)
====================================================================================
Verifica que el adaptador de Telegram procesa los comandos correctamente llamando a
BotService, y que NotificationDispatcher despacha alertas multi-canal.
"""

import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from services.telegram_adapter import TelegramAdapter, set_chat_language, get_chat_language
from services.notification_dispatcher import NotificationDispatcher

class TestTelegramAdapter(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.bot_service = MagicMock()
        self.bot_service.get_system_status.return_value = {
            "system_status": "ONLINE",
            "uptime_formatted": "2d 4h 10m",
            "mt5_connected": True,
            "account_number": 123456,
            "server": "Demo-Server",
            "circuit_breaker": {"can_trade": True, "risk_multiplier": 1.0},
            "autosignals_enabled": True,
            "monitored_symbols": ["EURUSD", "XAUUSD"],
            "news_indicator": "NORMAL"
        }
        self.bot_service.get_open_positions.return_value = []
        self.bot_service.get_account_equity.return_value = {
            "ok": True,
            "currency": "EUR",
            "balance": 10000.0,
            "equity": 10000.0,
            "margin": 0.0,
            "free_margin": 10000.0,
            "margin_level": 0.0,
            "floating_pnl": 0.0,
        }
        self.bot_service.get_risk_telemetry.return_value = {
            "can_trade": True,
            "open_positions_count": 0,
            "total_exposure_lots": 0.0,
            "total_floating_pnl": 0.0,
            "circuit_breaker": {"can_trade": True, "consecutive_losses": 0, "consecutive_wins": 0, "risk_multiplier": 1.0, "reason": ""}
        }
        self.bot_service.get_research_summary.return_value = {
            "total_experiments": 15,
            "promoted_count": 3,
            "candidates_count": 2,
            "rejected_count": 5,
            "recent_experiments": []
        }
        self.adapter = TelegramAdapter(bot_service=self.bot_service)
        self.adapter.token = "TEST_TOKEN"
        self.adapter.authorized_chat_id = "12345"

    def _create_mock_session(self):
        mock_session = MagicMock()
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value="{}")
        
        mock_post = MagicMock()
        mock_post.__aenter__ = AsyncMock(return_value=mock_response)
        mock_post.__aexit__ = AsyncMock(return_value=None)
        
        mock_session.post = MagicMock(return_value=mock_post)
        return mock_session, mock_post

    async def test_cmd_status(self):
        mock_session, mock_post = self._create_mock_session()
        await self.adapter._cmd_status(mock_session, 12345)
        
        self.assertTrue(mock_session.post.called)
        json_sent = mock_session.post.call_args[1]["json"]
        self.assertEqual(json_sent["chat_id"], 12345)
        self.assertTrue("LastEdge — System Status" in json_sent["text"] or "LastEdge — Estado del Bot" in json_sent["text"])

    async def test_cmd_positions(self):
        mock_session, mock_post = self._create_mock_session()
        await self.adapter._cmd_positions(mock_session, 12345)
        
        self.assertTrue(mock_session.post.called)
        json_sent = mock_session.post.call_args[1]["json"]
        self.assertTrue("MT5 Open Positions" in json_sent["text"] or "posiciones abiertas" in json_sent["text"].lower())

    async def test_cmd_equity(self):
        mock_session, mock_post = self._create_mock_session()
        await self.adapter._cmd_equity(mock_session, 12345)
        
        self.assertTrue(mock_session.post.called)
        json_sent = mock_session.post.call_args[1]["json"]
        self.assertIn("Balance", json_sent["text"])

    async def test_cmd_risk(self):
        mock_session, mock_post = self._create_mock_session()
        await self.adapter._cmd_risk(mock_session, 12345)
        
        self.assertTrue(mock_session.post.called)
        json_sent = mock_session.post.call_args[1]["json"]
        self.assertIn("Risk Engine v2", json_sent["text"])

    async def test_cmd_research(self):
        mock_session, mock_post = self._create_mock_session()
        await self.adapter._cmd_research(mock_session, 12345)
        
        self.assertTrue(mock_session.post.called)
        json_sent = mock_session.post.call_args[1]["json"]
        self.assertTrue("Research Database" in json_sent["text"] or "Base de Estrategias" in json_sent["text"])

    async def test_notification_dispatcher_broadcast(self):
        dispatcher = NotificationDispatcher()
        discord_received = []

        async def dummy_discord(msg):
            discord_received.append(msg)

        dispatcher.register_discord_handler(dummy_discord)
        
        res = await dispatcher.broadcast_message("Prueba de alerta simultánea", title="Alerta de Riesgo", level="WARNING")
        self.assertTrue(res["discord"])
        self.assertEqual(len(discord_received), 1)
        self.assertIn("Alerta de Riesgo", discord_received[0])

    async def test_persistent_reply_keyboard(self):
        """Verifica que el teclado persistente se incluye en la respuesta de ayuda enviada a Telegram."""
        mock_session, mock_post = self._create_mock_session()
        await self.adapter._cmd_help(mock_session, 12345)

        self.assertTrue(mock_session.post.called)
        json_sent = mock_session.post.call_args[1]["json"]
        self.assertIn("reply_markup", json_sent)
        markup = json_sent["reply_markup"]
        self.assertTrue(markup.get("resize_keyboard"))
        self.assertTrue(markup.get("is_persistent"))
        self.assertIn("keyboard", markup)

        # Verificar que contiene los botones principales
        flat_buttons = [btn["text"] for row in markup["keyboard"] for btn in row]
        self.assertIn("⚡ /status", flat_buttons)
        self.assertIn("📊 /positions", flat_buttons)
        self.assertIn("💰 /equity", flat_buttons)
        self.assertIn("🛡️ /risk", flat_buttons)

    async def test_cmd_start_inline_menu(self):
        """Verifica que /start despliega el menú interactivo con botones inline y selector de idioma."""
        mock_session, mock_post = self._create_mock_session()
        await self.adapter._cmd_start(mock_session, 12345)

        self.assertTrue(mock_session.post.called)
        json_sent = mock_session.post.call_args[1]["json"]
        self.assertIn("reply_markup", json_sent)
        markup = json_sent["reply_markup"]
        self.assertIn("inline_keyboard", markup)
        all_cb = [btn.get("callback_data") for row in markup["inline_keyboard"] for btn in row]
        self.assertIn("nav_positions", all_cb)
        self.assertIn("nav_status", all_cb)
        self.assertIn("toggle_language", all_cb)

    async def test_language_toggle(self):
        """Verifica alternancia entre inglés y español y persistencia."""
        set_chat_language(99999, "en")
        self.assertEqual(get_chat_language(99999), "en")
        new_lang = self.adapter.toggle_lang(99999)
        self.assertEqual(new_lang, "es")
        self.assertEqual(get_chat_language(99999), "es")
        new_lang2 = self.adapter.toggle_lang(99999)
        self.assertEqual(new_lang2, "en")

    async def test_emoji_button_routing(self):
        """Verifica que al pulsar un botón que envía '⚡ /status', se procesa el comando /status."""
        mock_session, mock_post = self._create_mock_session()
        update = {
            "message": {
                "chat": {"id": 12345},
                "from": {"id": "12345"},
                "text": "⚡ /status"
            }
        }
        await self.adapter._process_update(mock_session, update)

        self.assertTrue(mock_session.post.called)
        json_sent = mock_session.post.call_args[1]["json"]
        self.assertTrue("LastEdge — System Status" in json_sent["text"] or "LastEdge — Estado del Bot" in json_sent["text"])

    async def test_refresh_positions_callback(self):
        self.bot_service.get_open_positions.return_value = [
            {"ticket": 111, "symbol": "EURUSD", "type": "SELL", "volume": 0.1, "open_price": 1.12, "profit": -5.5, "sl": 1.13, "tp": 1.11}
        ]
        mock_session, mock_post = self._create_mock_session()
        cq = {
            "id": "cq_123",
            "data": "refresh_positions",
            "message": {"message_id": 999, "chat": {"id": 12345}},
            "from": {"id": "12345"}
        }
        await self.adapter._process_callback_query(mock_session, cq)
        self.assertTrue(mock_session.post.called)
        calls = [c[1]["json"] for c in mock_session.post.call_args_list if "text" in c[1].get("json", {})]
        self.assertTrue(any("Total Floating P&L" in c["text"] or "P&L Flotante Total" in c["text"] for c in calls))

    async def test_refresh_status_callback(self):
        mock_session, mock_post = self._create_mock_session()
        cq = {
            "id": "cq_456",
            "data": "refresh_status",
            "message": {"message_id": 999, "chat": {"id": 12345}},
            "from": {"id": "12345"}
        }
        await self.adapter._process_callback_query(mock_session, cq)
        self.assertTrue(mock_session.post.called)
        calls = [c[1]["json"] for c in mock_session.post.call_args_list if "text" in c[1].get("json", {})]
        self.assertTrue(any("LastEdge — System Status" in c["text"] or "LastEdge — Estado del Bot" in c["text"] for c in calls))


if __name__ == '__main__':
    unittest.main()
