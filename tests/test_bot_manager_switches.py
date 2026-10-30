"""
Test Bot Manager Activation Switches (ACTIVATE_DISCORD_BOT / ACTIVATE_TELEGRAM_BOT)
tests/test_bot_manager_switches.py
"""

import os
import unittest
from unittest.mock import patch
from services.bot_manager import _parse_bot_switch, BotManager


class TestBotManagerSwitches(unittest.TestCase):

    def test_parse_bot_switch(self):
        # Truthy variants
        for val in ["on", "ON", "On", "true", "TRUE", "1", "yes", "enabled"]:
            self.assertTrue(_parse_bot_switch(val), f"Failed for {val}")

        # Falsy variants
        for val in ["off", "OFF", "Off", "false", "FALSE", "0", "no", "disabled"]:
            self.assertFalse(_parse_bot_switch(val), f"Failed for {val}")

        # Defaults
        self.assertTrue(_parse_bot_switch(None, default=True))
        self.assertFalse(_parse_bot_switch(None, default=False))

    @patch.dict(os.environ, {
        "ACTIVATE_DISCORD_BOT": "off",
        "ACTIVATE_TELEGRAM_BOT": "on",
        "DISCORD_BOT_TOKEN": "valid_mock_discord_token_123456789",
        "TELEGRAM_BOT_TOKEN": "valid_mock_telegram_token_123456789"
    })
    def test_discord_off_telegram_on(self):
        bm = BotManager()
        self.assertFalse(bm.activate_discord)
        self.assertTrue(bm.activate_telegram)
        self.assertFalse(bm.is_discord_enabled())
        self.assertTrue(bm.is_telegram_enabled())
        self.assertTrue(bm.is_any_bot_configured())

        status = bm.get_status()
        self.assertFalse(status["discord"]["active"])
        self.assertFalse(status["discord"]["enabled"])
        self.assertTrue(status["discord"]["configured"])

        self.assertTrue(status["telegram"]["active"])
        self.assertTrue(status["telegram"]["enabled"])
        self.assertTrue(status["telegram"]["configured"])

    @patch.dict(os.environ, {
        "ACTIVATE_DISCORD_BOT": "on",
        "ACTIVATE_TELEGRAM_BOT": "off",
        "DISCORD_BOT_TOKEN": "valid_mock_discord_token_123456789",
        "TELEGRAM_BOT_TOKEN": "valid_mock_telegram_token_123456789"
    })
    def test_discord_on_telegram_off(self):
        bm = BotManager()
        self.assertTrue(bm.activate_discord)
        self.assertFalse(bm.activate_telegram)
        self.assertTrue(bm.is_discord_enabled())
        self.assertFalse(bm.is_telegram_enabled())
        self.assertTrue(bm.is_any_bot_configured())

        status = bm.get_status()
        self.assertTrue(status["discord"]["active"])
        self.assertTrue(status["discord"]["enabled"])
        self.assertFalse(status["telegram"]["active"])
        self.assertFalse(status["telegram"]["enabled"])

    @patch.dict(os.environ, {
        "ACTIVATE_DISCORD_BOT": "off",
        "ACTIVATE_TELEGRAM_BOT": "off",
        "DISCORD_BOT_TOKEN": "valid_mock_discord_token_123456789",
        "TELEGRAM_BOT_TOKEN": "valid_mock_telegram_token_123456789"
    })
    def test_both_bots_off(self):
        bm = BotManager()
        self.assertFalse(bm.activate_discord)
        self.assertFalse(bm.activate_telegram)
        self.assertFalse(bm.is_discord_enabled())
        self.assertFalse(bm.is_telegram_enabled())
        self.assertFalse(bm.is_any_bot_configured())

        # Calling start should not crash or start threads
        bm.start()
        self.assertFalse(bm.is_running)


if __name__ == "__main__":
    unittest.main()
