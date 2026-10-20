"""
Test Discord Slash Commands Service in LastEdge App
tests/test_commands_refactored.py

Validates that CommandsService consumes TradingClient and ResearchClient
without any direct imports from Trading Engine or Strategy Lab internals.
"""

import unittest
from unittest.mock import MagicMock, AsyncMock
from services.commands_refactored import CommandsService, create_commands_service
from services.clients.trading_client import TradingClient
from services.clients.research_client import ResearchClient


class TestDiscordCommandsService(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.mock_bot = MagicMock()
        self.mock_bot.tree = MagicMock()
        self.mock_bot.tree.command = MagicMock(return_value=lambda f: f)
        self.mock_bot.tree.get_commands = MagicMock(return_value=[1, 2, 3, 4, 5])
        self.mock_bot.user = "LastEdgeBot#1234"
        self.mock_bot.application_id = 99999999
        self.mock_bot.latency = 0.025

        self.mock_trading_client = MagicMock(spec=TradingClient)
        self.mock_research_client = MagicMock(spec=ResearchClient)

        self.svc = CommandsService(
            bot=self.mock_bot,
            config={"AUTHORIZED_USER_ID": 12345, "GUILD_ID": "123456789"},
            trading_client=self.mock_trading_client,
            research_client=self.mock_research_client
        )

    def test_setup_commands(self):
        """Verifies slash commands are registered."""
        self.svc.setup_commands()
        self.assertTrue(self.mock_bot.tree.command.called)

    def test_create_commands_service_factory(self):
        """Verifies factory helper create_commands_service."""
        svc = create_commands_service(
            bot=self.mock_bot,
            config={"AUTHORIZED_USER_ID": 12345},
            trading_client=self.mock_trading_client,
            research_client=self.mock_research_client
        )
        self.assertIsInstance(svc, CommandsService)
        self.assertEqual(svc.AUTHORIZED_USER_ID, 12345)

    def test_authorization(self):
        """Verifies authorized user check."""
        self.assertTrue(self.svc._is_authorized(12345))
        self.assertFalse(self.svc._is_authorized(99999))

        svc_no_auth = CommandsService(bot=self.mock_bot, config={"AUTHORIZED_USER_ID": 0})
        self.assertTrue(svc_no_auth._is_authorized(99999))

    def test_build_status_embed(self):
        """Verifies status embed creation."""
        st = {
            "status": "ONLINE",
            "uptime": "2h 30m",
            "mt5_connected": True,
            "account_number": "123456",
            "circuit_breaker": {"can_trade": True, "risk_multiplier": 1.0},
            "autosignals_enabled": True,
            "monitored_symbols": ["EURUSD", "XAUUSD"],
            "news_indicator": "🟢 Clean"
        }
        embed = self.svc._build_status_embed(st)
        self.assertEqual(embed.title, "⚡ LastEdge — Estado General del Sistema")
        self.assertEqual(len(embed.fields), 8)

    def test_build_positions_embed(self):
        """Verifies positions embed creation with positions and empty."""
        empty_embed, err_msg = self.svc._build_positions_embed({"positions": []})
        self.assertIsNone(empty_embed)
        self.assertIn("No hay posiciones", err_msg)

        data = {
            "positions": [
                {"ticket": 101, "symbol": "EURUSD", "type": "BUY", "volume": 0.1, "open_price": 1.085, "current_price": 1.090, "profit": 50.0}
            ]
        }
        embed, err = self.svc._build_positions_embed(data)
        self.assertIsNotNone(embed)
        self.assertIn("Posiciones Abiertas", embed.title)

    def test_build_autosignals_embed(self):
        """Verifies autosignals embed creation."""
        res = {"ok": True, "enabled": True, "min_confidence": "HIGH", "risk_pct": 0.5, "trailing_stop_mode": "atr"}
        embed = self.svc._build_autosignals_embed(res)
        self.assertIn("Auto-Ejecución", embed.title)
        self.assertIn("ACTIVADA", embed.description)


if __name__ == "__main__":
    unittest.main()
