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

    def notify_pending_signal(self, signal_data: Dict[str, Any]) -> None:
        """Notifica inmediatamente a Telegram y Discord cuando una señal requiera confirmación humana."""
        if not self.loop or not self.loop.is_running():
            return
        asyncio.run_coroutine_threadsafe(self._async_notify_pending_signal(signal_data), self.loop)

    async def _async_notify_pending_signal(self, signal_data: Dict[str, Any]) -> None:
        symbol = signal_data.get("symbol", "N/A")
        direction = signal_data.get("direction", signal_data.get("type", "BUY"))
        price = signal_data.get("price", signal_data.get("entry", 0.0))
        sl = signal_data.get("sl", signal_data.get("sl_price", 0.0))
        tp = signal_data.get("tp", signal_data.get("tp_price", 0.0))
        rr = signal_data.get("rr", signal_data.get("rr_ratio", signal_data.get("rrRatio", 0.0)))
        try:
            p_val = float(price or 0.0)
            sl_val = float(sl or 0.0)
            tp_val = float(tp or 0.0)
            if not rr and p_val and sl_val and p_val != sl_val:
                risk = abs(p_val - sl_val)
                reward = abs(tp_val - p_val)
                rr = reward / risk if risk > 0 else 0.0
        except Exception:
            rr = 0.0
        confidence = signal_data.get("confidence", signal_data.get("confidence_level", "MEDIUM"))
        strategy = signal_data.get("strategy", signal_data.get("strategy_used", "AutoSignals"))

        signal_id = signal_data.get("id") or signal_data.get("signal_id", "0")

        # 1. Telegram
        if self.telegram_token and self.telegram_chat_id:
            try:
                import aiohttp
                tg_text = (
                    "⏸️ SEÑAL PENDIENTE DE CONFIRMACIÓN\n"
                    "━━━━━━━━━━━━━━━━━━\n"
                    f"Par: {symbol} | Dirección: {direction}\n"
                    f"Precio: {price}\n"
                    f"SL: {sl} | TP: {tp} | R:R: 1:{rr:.2f}\n"
                    f"Confianza: {confidence} | Estrategia: {strategy}\n"
                    "━━━━━━━━━━━━━━━━━━\n"
                    "👉 Confirma o descarta con los botones inferiores o en tu Web Dashboard."
                )
                reply_markup = {
                    "inline_keyboard": [
                        [
                            {"text": "✅ Aprobar y Ejecutar", "callback_data": f"appr_{signal_id}"},
                            {"text": "❌ Descartar", "callback_data": f"rejc_{signal_id}"}
                        ]
                    ]
                }
                url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
                payload = {
                    "chat_id": self.telegram_chat_id,
                    "text": tg_text,
                    "reply_markup": reply_markup
                }
                async with aiohttp.ClientSession() as session:
                    await session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5))
            except Exception as e:
                logger.error(f"[Bot Manager] Error enviando alerta Telegram: {e}")

        # 2. Discord
        if self.discord_bot and self._discord_connected and self.discord_channel_id:
            try:
                import discord
                channel = self.discord_bot.get_channel(int(self.discord_channel_id))
                if channel:
                    embed = discord.Embed(
                        title=f"⏸️ SEÑAL PENDIENTE DE CONFIRMACIÓN | {direction} {symbol}",
                        description="👉 Pulsa \"Aprobar\" en tu Web Dashboard para ejecutarla en MT5.",
                        color=0xFFA500
                    )
                    embed.add_field(name="📈 Entry", value=f"{price}", inline=True)
                    embed.add_field(name="🛡️ Stop Loss", value=f"{sl}", inline=True)
                    embed.add_field(name="🎯 Take Profit", value=f"{tp}", inline=True)
                    embed.add_field(name="⚖️ R:R Ratio", value=f"1:{rr:.2f}", inline=True)
                    embed.add_field(name="⭐ Confidence", value=str(confidence), inline=True)
                    embed.add_field(name="⚙️ Strategy", value=str(strategy), inline=True)
                    embed.set_footer(text="Aprobación requerida vía Dashboard")
                    await channel.send(embed=embed)
            except Exception as e:
                logger.error(f"[Bot Manager] Error enviando alerta Discord: {e}")


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
