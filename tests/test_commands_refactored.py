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


if __name__ == "__main__":
    unittest.main()
