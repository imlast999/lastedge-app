"""
LastEdge App — Notification & Messaging Bot Manager
services/bot_manager.py

Orchestrates the background execution of:
1. Discord Bot (with Slash Commands via CommandsService and notifications)
2. Telegram Bot (via TelegramAdapter)

Operates completely decoupled in a dedicated background event loop thread.
Graceful Degradation:
- If neither bot is configured, logs an informative standby message without spinning up unnecessary threads.
- If tokens are missing or invalid, never crashes the Web Dashboard or API Gateway.
- Clean lifecycle management (starts with the app, stops cleanly on Ctrl+C).
"""

from __future__ import annotations

import os
import sys
import asyncio
import logging
import threading
from typing import Optional, Dict, Any

from services.clients.trading_client import get_trading_client
from services.clients.research_client import get_research_client

logger = logging.getLogger(__name__)


class BotManager:
    """Manages background Discord and Telegram bot adapters."""

    def __init__(self):
        self.discord_token = os.getenv("DISCORD_BOT_TOKEN") or os.getenv("DISCORD_TOKEN")
        self.discord_channel_id = os.getenv("DISCORD_CHANNEL_ID")
        self.telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.authorized_user_id = os.getenv("AUTHORIZED_USER_ID", "0")

        self.discord_bot = None
        self.commands_service = None
        self.telegram_adapter = None

        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.thread: Optional[threading.Thread] = None
        self.is_running = False

        self._discord_connected = False
        self._telegram_running = False

    def is_any_bot_configured(self) -> bool:
        has_discord = bool(self.discord_token and len(self.discord_token.strip()) > 10)
        has_telegram = bool(self.telegram_token and len(self.telegram_token.strip()) > 10)
        return has_discord or has_telegram

    def start(self):
        """Starts configured bots in a dedicated daemon thread with its own asyncio loop."""
        if self.is_running:
            return

        if not self.is_any_bot_configured():
            logger.info("ℹ️ [Bot Manager] Bots en Standby (DISCORD_BOT_TOKEN / TELEGRAM_BOT_TOKEN no configurados)")
            return

        self.is_running = True
        self.thread = threading.Thread(target=self._run_event_loop, daemon=True, name="LastEdgeBotLoop")
        self.thread.start()

    def _run_event_loop(self):
        """Dedicated asyncio event loop for external bots."""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        tasks = []

        # 1. Setup Discord Bot
        if self.discord_token and len(self.discord_token.strip()) > 10:
            try:
                import discord
                from discord.ext import commands
                from services.commands_refactored import create_commands_service

                intents = discord.Intents.default()
                try:
                    intents.message_content = True
                except Exception:
                    pass

                bot = commands.Bot(command_prefix=["!", "/"], intents=intents, help_command=None)
                self.discord_bot = bot

                config = {
                    "AUTHORIZED_USER_ID": int(self.authorized_user_id) if self.authorized_user_id.isdigit() else 0,
                    "DISCORD_CHANNEL_ID": self.discord_channel_id,
                    "GUILD_ID": os.getenv("GUILD_ID")
                }
                self.commands_service = create_commands_service(
                    bot=bot,
                    config=config,
                    trading_client=get_trading_client(),
                    research_client=get_research_client()
                )

                @bot.event
                async def on_ready():
                    self._discord_connected = True
                    print(f"🤖 [Discord Bot] Conectado exitosamente como {bot.user}")
                    sys.stdout.flush()
                    try:
                        guild_id = os.getenv("GUILD_ID")
                        if guild_id and guild_id.isdigit():
                            await bot.tree.sync(guild=discord.Object(id=int(guild_id)))
                        await bot.tree.sync()
                    except Exception as sync_err:
                        logger.warning(f"Error sincronizando comandos Discord: {sync_err}")

                async def _run_discord():
                    try:
                        logger.info("🤖 [Discord Bot] Iniciando sesión en Discord API...")
                        await bot.start(self.discord_token)
                    except discord.errors.PrivilegedIntentsRequired:
                        logger.warning("⚠️ [Discord Bot] PrivilegedIntentsRequired: Reintentando sin message_content...")
                        intents.message_content = False
                        bot_fallback = commands.Bot(command_prefix=["!", "/"], intents=intents, help_command=None)
                        self.discord_bot = bot_fallback
                        self.commands_service = create_commands_service(
                            bot=bot_fallback,
                            config=config,
                            trading_client=get_trading_client(),
                            research_client=get_research_client()
                        )
                        await bot_fallback.start(self.discord_token)
                    except (asyncio.CancelledError, KeyboardInterrupt):
                        pass
                    except Exception as e:
                        logger.error(f"❌ [Discord Bot] Error en Discord: {e}")
                    finally:
                        self._discord_connected = False

                tasks.append(_run_discord())
            except Exception as e:
                logger.error(f"❌ [Discord Bot] Error inicializando adaptador: {e}")

        # 2. Setup Telegram Bot
        if self.telegram_token and len(self.telegram_token.strip()) > 10:
            try:
                from services.telegram_adapter import TelegramAdapter
                adapter = TelegramAdapter(
                    trading_client=get_trading_client(),
                    research_client=get_research_client()
                )
                self.telegram_adapter = adapter

                async def _run_telegram():
                    try:
                        self._telegram_running = True
                        print("✈️ [Telegram Bot] Polling de comandos iniciado...")
                        sys.stdout.flush()
                        await adapter.start_polling()
                    except (asyncio.CancelledError, KeyboardInterrupt):
                        pass
                    except Exception as e:
                        logger.error(f"❌ [Telegram Bot] Error en Telegram: {e}")
                    finally:
                        self._telegram_running = False

                tasks.append(_run_telegram())
            except Exception as e:
                logger.error(f"❌ [Telegram Bot] Error inicializando adaptador: {e}")

        if tasks:
            try:
                self.loop.run_until_complete(asyncio.gather(*tasks, return_exceptions=True))
            except Exception as e:
                logger.debug(f"[Bot Manager] Loop terminado: {e}")
            finally:
                self.loop.close()

    def stop(self):
        """Gracefully stops all running bots."""
        if not self.is_running:
            return

        self.is_running = False

        if self.telegram_adapter:
            try:
                self.telegram_adapter.stop()
            except Exception:
                pass

        if self.discord_bot and self.loop and self.loop.is_running():
            try:
                asyncio.run_coroutine_threadsafe(self.discord_bot.close(), self.loop)
            except Exception:
                pass

    def get_status(self) -> Dict[str, Any]:
        return {
            "discord": {
                "configured": bool(self.discord_token and len(self.discord_token.strip()) > 10),
                "connected": self._discord_connected,
                "bot_user": str(self.discord_bot.user) if (self.discord_bot and self.discord_bot.user) else None
            },
            "telegram": {
                "configured": bool(self.telegram_token and len(self.telegram_token.strip()) > 10),
                "running": self._telegram_running
            }
        }


_bot_manager: Optional[BotManager] = None


def get_bot_manager() -> BotManager:
    global _bot_manager
    if _bot_manager is None:
        _bot_manager = BotManager()
    return _bot_manager


def start_bot_manager() -> BotManager:
    bm = get_bot_manager()
    bm.start()
    return bm
