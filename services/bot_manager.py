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
        self.discord_channel_id = os.getenv("DISCORD_CHANNEL_ID") or "1458605750392852530"
        self.telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.authorized_user_id = os.getenv("AUTHORIZED_USER_ID", "0")

        self.trading_client = get_trading_client()
        self._notified_signals: set = set()
        self._pending_tg_messages: Dict[str, Dict[str, Any]] = {}

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

        # 0. Signals Watcher Background Task
        tasks.append(self._run_signals_watcher())

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

                        @bot_fallback.event
                        async def on_ready():
                            self._discord_connected = True
                            print(f"🤖 [Discord Bot Fallback] Conectado exitosamente como {bot_fallback.user}")
                            sys.stdout.flush()
                            try:
                                guild_id = os.getenv("GUILD_ID")
                                if guild_id and guild_id.isdigit():
                                    await bot_fallback.tree.sync(guild=discord.Object(id=int(guild_id)))
                                await bot_fallback.tree.sync()
                            except Exception as sync_err:
                                logger.warning(f"Error sincronizando comandos Discord fallback: {sync_err}")

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

    async def _run_signals_watcher(self):
        """Monitorea periódicamente las señales pendientes en Trading Engine y despacha alertas interactivas."""
        logger.info("📡 [Signals Watcher] Monitor de señales pendientes activado (intervalo: 5s).")
        while self.is_running:
            try:
                res = await asyncio.to_thread(self.trading_client.get_signals)
                signals = res.get("signals", []) if isinstance(res, dict) else (res if isinstance(res, list) else [])
                current_pending_ids = set()

                for sig in signals:
                    status = str(sig.get("status", "")).lower()
                    sig_id = str(sig.get("id") or sig.get("signal_id", ""))
                    if status in ["pending", "proposed"]:
                        if sig_id:
                            current_pending_ids.add(sig_id)
                            if sig_id not in self._notified_signals:
                                self._notified_signals.add(sig_id)
                                logger.info(f"🔔 [Signals Watcher] Señal pendiente #{sig_id} detectada. Despachando alertas...")
                                try:
                                    await self._async_notify_pending_signal(sig)
                                except Exception as n_err:
                                    logger.error(f"[Signals Watcher] Error notificando señal #{sig_id}: {n_err}")

                # Comprobar expiración o cambio de estado de señales notificadas por Telegram
                now_ts = time.time()
                for p_sig_id, tg_info in list(self._pending_tg_messages.items()):
                    is_time_expired = (now_ts - tg_info.get("sent_at", 0)) >= 600
                    matching_sig = next((s for s in signals if str(s.get("id") or s.get("signal_id")) == str(p_sig_id)), None)
                    sig_status = str(matching_sig.get("status", "")).upper() if matching_sig else ""

                    if is_time_expired or sig_status in ("EXPIRED", "REJECTED", "REJECTED_MANUAL"):
                        if is_time_expired and sig_status in ("PROPOSED", "PENDING"):
                            try:
                                await asyncio.to_thread(self.trading_client.reject_signal, int(p_sig_id))
                            except Exception:
                                pass

                        sym = tg_info.get("symbol", "N/A")
                        direction = tg_info.get("direction", "BUY")
                        px = tg_info.get("price", "N/A")
                        expired_text = (
                            "⏳ SEÑAL EXPIRADA (Sin confirmación tras 10 min)\n"
                            "━━━━━━━━━━━━━━━━━━\n"
                            f"Par: {sym} | Dirección: {direction}\n"
                            f"Precio: {px}\n"
                            "Estado: EXPIRADA ⌛\n"
                            "━━━━━━━━━━━━━━━━━━\n"
                            "⚠️ Esta señal ya no está disponible para su ejecución."
                        )
                        logger.info(f"⏳ [Signals Watcher] Editando mensaje Telegram de señal #{p_sig_id} a EXPIRADA...")
                        await self._edit_telegram_message(
                            tg_info["chat_id"],
                            tg_info["message_id"],
                            expired_text,
                            reply_markup={"inline_keyboard": []}
                        )
                        self._pending_tg_messages.pop(p_sig_id, None)
                    elif sig_status in ("EXECUTED", "ACCEPTED"):
                        self._pending_tg_messages.pop(p_sig_id, None)

                # Limpiar del set las señales que hayan expirado o hayan dejado de estar pendientes
                if self._notified_signals:
                    self._notified_signals.intersection_update(current_pending_ids)

            except Exception as e:
                logger.debug(f"[Signals Watcher] Error en ciclo de sondeo: {e}")

            await asyncio.sleep(5)

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

    async def _edit_telegram_message(
        self,
        chat_id: Any,
        message_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None
    ) -> bool:
        if not self.telegram_token:
            return False
        try:
            import aiohttp, ssl
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            connector = aiohttp.TCPConnector(ssl=ssl_ctx)
            url = f"https://api.telegram.org/bot{self.telegram_token}/editMessageText"
            payload = {
                "chat_id": chat_id,
                "message_id": message_id,
                "text": text,
                "reply_markup": reply_markup if reply_markup is not None else {"inline_keyboard": []}
            }
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    return resp.status == 200
        except Exception as e:
            logger.debug(f"[Bot Manager] Error editando mensaje #{message_id}: {e}")
            return False

    def notify_pending_signal(self, signal_data: Dict[str, Any]) -> None:
        """Notifica inmediatamente a Telegram y Discord cuando una señal requiera confirmación humana."""
        if not self.loop or not self.loop.is_running():
            return
        asyncio.run_coroutine_threadsafe(self._async_notify_pending_signal(signal_data), self.loop)

    async def _async_notify_pending_signal(self, signal_data: Dict[str, Any]) -> None:
        symbol = signal_data.get("symbol", "N/A")
        direction = signal_data.get("direction") or signal_data.get("type") or "BUY"
        price = signal_data.get("price") or signal_data.get("entry") or signal_data.get("entry_price") or 0.0
        sl = signal_data.get("sl") or signal_data.get("sl_price") or signal_data.get("stopLoss") or 0.0
        tp = signal_data.get("tp") or signal_data.get("tp_price") or signal_data.get("takeProfit") or 0.0
        rr = signal_data.get("rr") or signal_data.get("rr_ratio") or signal_data.get("rrRatio") or 0.0
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
        confidence = signal_data.get("confidence") or signal_data.get("confidence_level") or "MEDIUM"
        strategy = signal_data.get("strategy") or signal_data.get("strategy_used") or "AutoSignals"

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
                import ssl
                ssl_ctx = ssl.create_default_context()
                ssl_ctx.check_hostname = False
                ssl_ctx.verify_mode = ssl.CERT_NONE
                connector = aiohttp.TCPConnector(ssl=ssl_ctx)
                async with aiohttp.ClientSession(connector=connector) as session:
                    async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            msg_id = data.get("result", {}).get("message_id")
                            if msg_id and signal_id:
                                self._pending_tg_messages[str(signal_id)] = {
                                    "message_id": msg_id,
                                    "chat_id": self.telegram_chat_id,
                                    "symbol": symbol,
                                    "direction": direction,
                                    "price": price,
                                    "sent_at": time.time(),
                                }
            except Exception as e:
                logger.error(f"[Bot Manager] Error enviando alerta Telegram: {e}")

        # 2. Discord
        discord_cid = self.discord_channel_id or os.getenv("DISCORD_CHANNEL_ID") or "1458605750392852530"
        if self.discord_bot and self._discord_connected and discord_cid:
            try:
                import discord
                channel = self.discord_bot.get_channel(int(discord_cid))
                if not channel:
                    try:
                        channel = await self.discord_bot.fetch_channel(int(discord_cid))
                    except Exception:
                        channel = None
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
