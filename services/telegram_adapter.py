"""
TelegramAdapter — Adaptador de Telegram para LastEdge (P2.5)
============================================================
Adaptador asíncrono, liviano y desacoplado para Telegram.
Consume `BotService` (si está presente) o los clientes REST (`TradingClient` y `ResearchClient`).

Soporta comandos por chat:
  /start o /help    - Menú de ayuda e instrucciones
  /status           - Estado unificado del bot, uptime, MT5, Circuit Breaker
  /positions        - Posiciones abiertas en MT5 con P&L flotante
  /close_position   - Cierra una posición por número de ticket
  /equity           - Balance, equity, margen y nivel de margen
  /risk             - Telemetría de Risk Engine v2 y Circuit Breaker
  /journal          - Resumen de calidad de ejecución (30 días)
  /research         - Resumen de la Research Database
  /autosignals      - Estado/toggle de auto-ejecución (on/off/status)
  /health           - Diagnóstico técnico de la infraestructura
  /version          - Información sobre la versión y despliegue
  /logs             - Muestra eventos o errores recientes
  /ping             - Comprobación de latencia de respuesta
"""

import os
import sys
import time
import logging
import asyncio
from typing import Optional, Dict, Any, List
import aiohttp

from services.clients.trading_client import get_trading_client, TradingClient
from services.clients.research_client import get_research_client, ResearchClient

logger = logging.getLogger(__name__)


class TelegramAdapter:
    """Adaptador asíncrono y de alta concurrencia para el bot de Telegram."""

    def __init__(
        self,
        bot_service: Optional[Any] = None,
        trading_client: Optional[TradingClient] = None,
        research_client: Optional[ResearchClient] = None
    ):
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.authorized_chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.authorized_user_id = os.getenv("TELEGRAM_AUTHORIZED_USER_ID")
        self.bot_service = bot_service
        self.trading_client = trading_client or get_trading_client()
        self.research_client = research_client or get_research_client()
        self.last_update_id = 0
        self.is_running = False

    def is_configured(self) -> bool:
        """Indica si las credenciales de Telegram están presentes."""
        return bool(self.token and len(self.token.strip()) > 10)

    async def start_polling(self):
        """Inicia el bucle de polling asíncrono de comandos de Telegram."""
        if not self.is_configured():
            logger.info("[TelegramAdapter] TELEGRAM_BOT_TOKEN no configurado. Adaptador en espera.")
            return

        self.is_running = True
        logger.info("[TelegramAdapter] 🚀 Iniciando polling del bot de Telegram...")

        import ssl
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)

        timeout = aiohttp.ClientTimeout(total=20)
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            while self.is_running:
                try:
                    url = f"https://api.telegram.org/bot{self.token}/getUpdates"
                    params = {"offset": self.last_update_id + 1, "timeout": 3}
                    async with session.get(url, params=params) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if data.get("ok") and data.get("result"):
                                for update in data["result"]:
                                    self.last_update_id = update["update_id"]
                                    # Procesar de forma concurrente para no bloquear el bucle de polling
                                    asyncio.create_task(self._safe_process_update(session, update))
                        else:
                            await asyncio.sleep(1)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.debug(f"[TelegramAdapter] Polling transitorio: {e}")
                    await asyncio.sleep(1)

    def stop(self):
        """Detiene el bucle de polling del bot de Telegram."""
        self.is_running = False

    async def _safe_process_update(self, session: aiohttp.ClientSession, update: Dict[str, Any]):
        """Envuelve el procesamiento del mensaje o callback para que ningún error detenga el polling."""
        try:
            if "callback_query" in update:
                await self._process_callback_query(session, update["callback_query"])
            elif "message" in update:
                await self._process_update(session, update)
        except Exception as e:
            logger.error(f"[TelegramAdapter] Error procesando actualización: {e}", exc_info=True)
            try:
                chat_id = update.get("message", {}).get("chat", {}).get("id")
                if chat_id:
                    await self._send_response(session, chat_id, f"⚠️ Error al procesar comando: {e}")
            except Exception:
                pass

    async def _answer_callback_query(
        self,
        session: aiohttp.ClientSession,
        callback_query_id: str,
        text: Optional[str] = None
    ):
        """Notifica a la API de Telegram que el callback fue recibido (quita el spinner del botón)."""
        try:
            url = f"https://api.telegram.org/bot{self.token}/answerCallbackQuery"
            payload: Dict[str, Any] = {"callback_query_id": callback_query_id}
            if text:
                payload["text"] = text
            client_timeout = aiohttp.ClientTimeout(total=5)
            async with session.post(url, json=payload, timeout=client_timeout):
                pass
        except Exception as e:
            logger.debug(f"[TelegramAdapter] answerCallbackQuery warning: {e}")

    async def _edit_message_text(
        self,
        session: aiohttp.ClientSession,
        chat_id: int,
        message_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None
    ):
        """Edita un mensaje existente en Telegram sustituyendo su texto y botones inline."""
        try:
            url = f"https://api.telegram.org/bot{self.token}/editMessageText"
            payload: Dict[str, Any] = {
                "chat_id": chat_id,
                "message_id": message_id,
                "text": text,
            }
            if reply_markup is not None:
                payload["reply_markup"] = reply_markup
            else:
                payload["reply_markup"] = {"inline_keyboard": []}

            client_timeout = aiohttp.ClientTimeout(total=6)
            async with session.post(url, json=payload, timeout=client_timeout) as resp:
                if resp.status != 200:
                    err_msg = await resp.text()
                    logger.debug(f"[TelegramAdapter] editMessageText warning (status {resp.status}): {err_msg}")
        except Exception as e:
            logger.error(f"[TelegramAdapter] Error editando mensaje #{message_id}: {e}")

    async def _process_callback_query(self, session: aiohttp.ClientSession, cq: Dict[str, Any]):
        """
        Gestiona las interacciones con botones inline (Aprobar, Rechazar, Forzar con Desviación).
        """
        cq_id = cq.get("id")
        data = cq.get("data", "")
        msg = cq.get("message", {})
        chat_id = msg.get("chat", {}).get("id")
        message_id = msg.get("message_id")
        from_user_id = str(cq.get("from", {}).get("id", ""))

        if self.authorized_user_id and from_user_id != str(self.authorized_user_id):
            if cq_id:
                await self._answer_callback_query(session, cq_id, "⛔ No estás autorizado.")
            return

        if cq_id:
            await self._answer_callback_query(session, cq_id)

        if not chat_id or not message_id or not data:
            return

        # ── Caso A: Descartar Señal ──────────────────────────────────────────
        if data.startswith("rejc_"):
            try:
                sig_id = int(data.split("_")[1])
            except Exception:
                sig_id = 0

            self.trading_client.reject_signal(sig_id)
            new_text = "❌ SEÑAL DESCARTADA MANUALMENTE | Cancelada por el usuario."
            await self._edit_message_text(session, chat_id, message_id, new_text, reply_markup={"inline_keyboard": []})
            logger.info(f"🚫 [TelegramAdapter] Señal #{sig_id} descartada vía botón de Telegram.")

        # ── Caso B: Aprobar y Ejecutar Señal ──────────────────────────────────
        elif data.startswith("appr_"):
            try:
                sig_id = int(data.split("_")[1])
            except Exception:
                sig_id = 0

            res = self.trading_client.approve_signal(sig_id, force=False)

            # Sub-caso B1: Desviación detectada (PRICE_DRIFT)
            if res.get("error") == "PRICE_DRIFT":
                signal_price = res.get("signal_price", "N/A")
                current_price = res.get("current_price", "N/A")
                drift_pips = res.get("drift_pips", "N/A")

                drift_text = (
                    "⚠️ ALERTA DE DESVIACIÓN DE PRECIO\n"
                    "━━━━━━━━━━━━━━━━━━\n"
                    "El precio de mercado se ha movido desde la emisión de la señal:\n"
                    f"• Precio señal: {signal_price}\n"
                    f"• Precio actual MT5: {current_price} (Desviación: {drift_pips})\n"
                    "━━━━━━━━━━━━━━━━━━\n"
                    "¿Deseas ejecutar la orden al precio de mercado actual?"
                )
                drift_markup = {
                    "inline_keyboard": [
                        [
                            {"text": "⚡ Sí, Ejecutar a Mercado", "callback_data": f"force_{sig_id}"},
                            {"text": "🚫 Cancelar", "callback_data": f"rejc_{sig_id}"}
                        ]
                    ]
                }
                await self._edit_message_text(session, chat_id, message_id, drift_text, reply_markup=drift_markup)

            # Sub-caso B2: Aprobada con éxito sin desviación
            elif res.get("ok"):
                ticket = res.get("ticket", "N/A")
                exec_price = res.get("executed_price", "N/A")
                success_text = f"✅ ORDEN EJECUTADA EN MT5 | Ticket #{ticket} @ {exec_price}"
                await self._edit_message_text(session, chat_id, message_id, success_text, reply_markup={"inline_keyboard": []})
                logger.info(f"✅ [TelegramAdapter] Señal #{sig_id} aprobada y ejecutada en MT5. Ticket: {ticket}")

            # Sub-caso Error
            else:
                err_text = f"❌ Error al ejecutar señal #{sig_id}: {res.get('error') or res.get('message', 'Fallo desconocido')}"
                await self._edit_message_text(session, chat_id, message_id, err_text, reply_markup={"inline_keyboard": []})

        # ── Caso C: Confirmar Fuerza tras Desviación (force_execute) ──────────
        elif data.startswith("force_"):
            try:
                sig_id = int(data.split("_")[1])
            except Exception:
                sig_id = 0

            res = self.trading_client.approve_signal(sig_id, force=True)
            if res.get("ok"):
                ticket = res.get("ticket", "N/A")
                exec_price = res.get("executed_price", "N/A")
                success_text = f"✅ ORDEN EJECUTADA EN MT5 | Ticket #{ticket} @ {exec_price}"
                await self._edit_message_text(session, chat_id, message_id, success_text, reply_markup={"inline_keyboard": []})
                logger.info(f"⚡ [TelegramAdapter] Señal #{sig_id} forzada a mercado en MT5. Ticket: {ticket}")
            else:
                err_text = f"❌ Error ejecutando a mercado señal #{sig_id}: {res.get('error') or res.get('message', 'Fallo desconocido')}"
                await self._edit_message_text(session, chat_id, message_id, err_text, reply_markup={"inline_keyboard": []})


    @staticmethod
    def get_persistent_keyboard() -> Dict[str, Any]:
        """Devuelve el teclado inferior persistente (ReplyKeyboardMarkup) para el usuario."""
        return {
            "keyboard": [
                [{"text": "⚡ /status"}, {"text": "📊 /positions"}],
                [{"text": "💰 /equity"}, {"text": "🛡️ /risk"}],
                [{"text": "📖 /journal"}, {"text": "🔬 /research"}],
                [{"text": "⚙️ /autosignals"}, {"text": "🩺 /health"}],
                [{"text": "🏓 /ping"}, {"text": "❓ /help"}]
            ],
            "resize_keyboard": True,
            "is_persistent": True
        }

    async def _process_update(self, session: aiohttp.ClientSession, update: Dict[str, Any]):
        """Procesa una actualización/mensaje entrante de Telegram."""
        start_t = time.perf_counter()
        message = update.get("message")
        if not message or "text" not in message:
            return

        chat_id = message["chat"]["id"]
        from_user_id = str(message.get("from", {}).get("id", ""))
        text = message["text"].strip()

        # Verificación de autorización opcional si TELEGRAM_AUTHORIZED_USER_ID está configurado
        if self.authorized_user_id and from_user_id != str(self.authorized_user_id):
            await self._send_response(session, chat_id, "⛔ No autorizado para controlar LastEdge.")
            return

        # Enrutamiento de Comandos (compatible con texto escrito y botones con emojis)
        words = text.split()
        command = ""
        args = []

        # 1. Buscar si alguna palabra es un comando con barra (ej: "/status" o "⚡ /status")
        for i, w in enumerate(words):
            clean_w = w.split("@")[0].lower()
            if clean_w.startswith("/"):
                command = clean_w
                args = words[i+1:]
                break

        # 2. Si no tiene barra, buscar por alias de texto o emoji
        if not command and words:
            first = words[0].lower()
            aliases = {
                "status": "/status",
                "estado": "/status",
                "positions": "/positions",
                "posiciones": "/positions",
                "pos": "/positions",
                "equity": "/equity",
                "balance": "/equity",
                "cuenta": "/equity",
                "risk": "/risk",
                "riesgo": "/risk",
                "journal": "/journal",
                "diario": "/journal",
                "research": "/research",
                "lab": "/research",
                "autosignals": "/autosignals",
                "señales": "/autosignals",
                "signals": "/autosignals",
                "health": "/health",
                "salud": "/health",
                "version": "/version",
                "ping": "/ping",
                "help": "/help",
                "ayuda": "/help",
                "start": "/start",
                "inicio": "/start",
            }
            if first in aliases:
                command = aliases[first]
                args = words[1:]

        if command in ("/start", "/help"):
            await self._cmd_help(session, chat_id)
        elif command == "/status":
            await self._cmd_status(session, chat_id)
        elif command == "/positions":
            await self._cmd_positions(session, chat_id)
        elif command == "/close_position":
            await self._cmd_close_position(session, chat_id, args)
        elif command in ("/equity", "/balance"):
            await self._cmd_equity(session, chat_id)
        elif command == "/risk":
            await self._cmd_risk(session, chat_id)
        elif command == "/journal":
            await self._cmd_journal(session, chat_id)
        elif command == "/research":
            await self._cmd_research(session, chat_id)
        elif command == "/autosignals":
            mode = args[0] if args else "status"
            await self._cmd_autosignals(session, chat_id, mode)
        elif command == "/health":
            await self._cmd_health(session, chat_id)
        elif command == "/version":
            await self._cmd_version(session, chat_id)
        elif command == "/logs":
            await self._cmd_logs(session, chat_id)
        elif command == "/ping":
            elapsed_ms = int((time.perf_counter() - start_t) * 1000)
            await self._send_response(session, chat_id, f"🏓 Pong! Latencia de respuesta: {elapsed_ms} ms")

    async def _send_response(
        self,
        session: aiohttp.ClientSession,
        chat_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None
    ):
        """Envía una respuesta a Telegram, con teclado persistente y reintento en texto plano."""
        try:
            url = f"https://api.telegram.org/bot{self.token}/sendMessage"
            payload: Dict[str, Any] = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
            }
            markup = reply_markup if reply_markup is not None else self.get_persistent_keyboard()
            if markup:
                payload["reply_markup"] = markup

            client_timeout = aiohttp.ClientTimeout(total=6)
            async with session.post(url, json=payload, timeout=client_timeout) as resp:
                if resp.status != 200:
                    # Reintentar en texto plano para evitar bloqueos por caracteres reservados en Markdown
                    payload.pop("parse_mode", None)
                    async with session.post(url, json=payload, timeout=client_timeout) as retry_resp:
                        if retry_resp.status != 200:
                            err_text = await retry_resp.text()
                            logger.error(f"[TelegramAdapter] Fallo al enviar mensaje: {err_text}")
        except Exception as e:
            logger.error(f"[TelegramAdapter] Error enviando respuesta: {e}")

    # ── Manejadores de Comandos ──────────────────────────────────────────────

    async def _cmd_help(self, session: aiohttp.ClientSession, chat_id: int):
        help_text = (
            "⚡ *LastEdge — Panel de Control en Telegram*\n\n"
            "Se ha activado tu teclado de control inferior con botones de acceso rápido para "
            "ejecutar comandos sin necesidad de escribirlos.\n\n"
            "🔘 *Botones en tu teclado:*\n"
            "• `⚡ /status` — Estado general, MT5 y Circuit Breaker\n"
            "• `📊 /positions` — Posiciones abiertas y P&L flotante\n"
            "• `💰 /equity` — Balance, capital flotante y márgenes\n"
            "• `🛡️ /risk` — Telemetría del Risk Engine v2\n"
            "• `📖 /journal` — Métricas de ejecución (30 días)\n"
            "• `🔬 /research` — Base de datos de estrategias\n"
            "• `⚙️ /autosignals` — Control del auto-trading\n"
            "• `🩺 /health` — Diagnóstico técnico del ecosistema\n"
            "• `🏓 /ping` — Comprobación de latencia de red\n\n"
            "✍️ *Comandos con parámetros por texto:*\n"
            "• `/close_position <ticket>` — Cierra una orden específica\n"
            "• `/autosignals on` | `/autosignals off` — Activa/pausa el auto-trading\n"
            "• `/journal 7` — Ver historial de los últimos 7 días"
        )
        await self._send_response(session, chat_id, help_text)

    async def _cmd_status(self, session: aiohttp.ClientSession, chat_id: int):
        if self.bot_service:
            st = self.bot_service.get_system_status()
        else:
            t_stat = await asyncio.to_thread(self.trading_client.get_status)
            metrics_res = await asyncio.to_thread(self.trading_client.get_metrics)
            metrics = metrics_res.get("metrics", {})
            cb = metrics.get("circuit_breaker", {})
            health = t_stat.get("health", {})
            st = {
                "system_status": t_stat.get("status", "ONLINE"),
                "uptime_formatted": t_stat.get("uptime", "0h 0m"),
                "mt5_connected": bool(t_stat.get("mt5_connected") or health.get("mt5_connected")),
                "account_number": (
                    t_stat.get("account_number") or
                    (health.get("mt5", {}).get("login") if isinstance(health.get("mt5"), dict) else None) or
                    "2100285342"
                ),
                "circuit_breaker": cb,
                "autosignals_enabled": bool(health.get("autosignals", {}).get("enabled", True)),
                "monitored_symbols": health.get("autosignals", {}).get("symbols", ["EURUSD", "XAUUSD", "BTCEUR"]),
                "news_indicator": "🟢 OK",
            }

        mt5_st = "🟢 Conectado" if st.get("mt5_connected") else "🔴 Desconectado"
        cb = st.get("circuit_breaker", {})
        cb_st = "🟢 Activo" if cb.get("can_trade", True) else "🔴 Pausado"

        text = (
            "⚡ LastEdge — Estado del Bot\n\n"
            f"• Estado: {st.get('system_status', 'ONLINE')}\n"
            f"• Uptime: {st.get('uptime_formatted', '—')}\n"
            f"• MT5 Broker: {mt5_st}\n"
            f"• Cuenta: {st.get('account_number') or '—'}\n"
            f"• Circuit Breaker: {cb_st} (×{cb.get('risk_multiplier', 1.0):.1f})\n"
            f"• Autosignals: {'✅ Activo' if st.get('autosignals_enabled') else '⏸ Desactivado'}\n"
            f"• Pares Monitoreados: {', '.join(st.get('monitored_symbols', []))}\n"
            f"• Filtro Noticias: {st.get('news_indicator', '🟢 OK')}\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_positions(self, session: aiohttp.ClientSession, chat_id: int):
        if self.bot_service:
            positions = self.bot_service.get_open_positions()
        else:
            res = await asyncio.to_thread(self.trading_client.get_positions)
            positions = res.get("positions", [])

        if not positions:
            await self._send_response(session, chat_id, "ℹ️ No hay posiciones abiertas actualmente en MT5.")
            return

        text = f"📊 Posiciones Abiertas en MT5 ({len(positions)})\n\n"
        for p in positions:
            profit = float(p.get("profit", 0.0))
            pnl_emoji = "🟢" if profit >= 0 else "🔴"
            ticket = p.get("ticket", 0)
            symbol = p.get("symbol", "EURUSD")
            ptype = p.get("type", "BUY")
            vol = float(p.get("volume", 0.0))
            open_p = float(p.get("open_price", 0.0))
            text += (
                f"• #{ticket} — {symbol} ({ptype})\n"
                f"  Lotes: {vol:.2f} | Entrada: {open_p:.5f}\n"
                f"  P&L: {pnl_emoji} {profit:+.2f} €\n\n"
            )
        await self._send_response(session, chat_id, text)

    async def _cmd_close_position(self, session: aiohttp.ClientSession, chat_id: int, args: List[str]):
        if not args or not args[0].isdigit():
            await self._send_response(session, chat_id, "⚠️ Uso: /close_position <ticket>")
            return

        ticket = int(args[0])
        if self.bot_service:
            res = self.bot_service.close_position(ticket)
        else:
            res = await asyncio.to_thread(self.trading_client.close_position, ticket)

        msg = f"✅ {res.get('message', 'Posición cerrada con éxito')}" if res.get("ok") else f"❌ {res.get('message', 'Error al cerrar posición')}"
        await self._send_response(session, chat_id, msg)

    async def _cmd_equity(self, session: aiohttp.ClientSession, chat_id: int):
        if self.bot_service:
            acc = self.bot_service.get_account_equity()
        else:
            res = await asyncio.to_thread(self.trading_client.get_equity)
            acc = res.get("equity", {})

        if not acc:
            await self._send_response(session, chat_id, "❌ Error al obtener telemetría de cuenta.")
            return

        bal = float(acc.get("balance", 0.0))
        eq = float(acc.get("equity", bal))
        pnl = float(acc.get("floating_pnl", eq - bal))
        mrg = float(acc.get("margin", 0.0))
        fm = float(acc.get("free_margin", eq - mrg))
        ml = float(acc.get("margin_level", 0.0))
        curr = acc.get("currency", "USD")
        pnl_emoji = "🟢" if pnl >= 0 else "🔴"

        text = (
            "💰 Balance & Equity — MT5 Account\n\n"
            f"• Balance: {bal:,.2f} {curr}\n"
            f"• Equity: {eq:,.2f} {curr}\n"
            f"• P&L Flotante: {pnl_emoji} {pnl:+.2f} {curr}\n"
            f"• Margen Usado: {mrg:,.2f} {curr}\n"
            f"• Margen Libre: {fm:,.2f} {curr}\n"
            f"• Nivel de Margen: {ml:.1f}%\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_risk(self, session: aiohttp.ClientSession, chat_id: int):
        if self.bot_service:
            rk = self.bot_service.get_risk_telemetry()
        else:
            rk = await asyncio.to_thread(self.trading_client.get_risk)

        cb = rk.get("circuit_breaker", {})
        status_str = "🟢 OPERATIVO" if rk.get("can_trade", True) else "🔴 PAUSADO (Circuit Breaker)"
        open_pos = rk.get("open_positions_count", 0)
        lots = rk.get("total_exposure_lots", 0.0)
        float_pnl = float(rk.get("total_floating_pnl", 0.0))

        text = (
            "🛡️ Risk Engine v2 — Telemetría\n\n"
            f"• Estado: {status_str}\n"
            f"• Multiplicador Riesgo: ×{cb.get('risk_multiplier', 1.0):.1f}\n"
            f"• Rachas: Perdidas {cb.get('consecutive_losses', 0)} | Ganadas {cb.get('consecutive_wins', 0)}\n"
            f"• Posiciones: {open_pos} ({lots} lotes)\n"
            f"• P&L Flotante Total: {float_pnl:+.2f} €\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_journal(self, session: aiohttp.ClientSession, chat_id: int):
        if self.bot_service:
            res = self.bot_service.get_journal_summary(days=30)
            stats = res.get("stats", {})
        else:
            res = await asyncio.to_thread(self.trading_client.get_execution_analytics)
            stats = res.get("analytics", {}).get("analytics", res.get("analytics", {}))

        total_orders = stats.get("total_orders", 0)
        rejection_rate = float(stats.get("rejection_rate_pct", 0.0))
        spread = float(stats.get("avg_spread_pips", 0.0))
        latency = float(stats.get("avg_latency_ms", 0.0))
        slippage = float(stats.get("avg_slippage_pips", 0.0))
        cost = float(stats.get("total_slippage_cost_eur", 0.0))

        text = (
            "📖 Diario de Ejecución (30 Días)\n\n"
            f"• Total Órdenes: {total_orders}\n"
            f"• Tasa de Rechazo: {rejection_rate:.1f}%\n"
            f"• Spread Medio: {spread:.1f} pips\n"
            f"• Latencia Media: {latency:.0f} ms\n"
            f"• Slippage Medio: {slippage:+.2f} pips\n"
            f"• Costo Slippage: {cost:+.2f} €\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_research(self, session: aiohttp.ClientSession, chat_id: int):
        if self.bot_service:
            res = self.bot_service.get_research_summary()
        else:
            res = await asyncio.to_thread(self.research_client.get_status)

        tot = res.get("total_experiments", 0)
        prom = res.get("promoted_count", 0)
        cand = res.get("candidates_count", 0)
        rej = res.get("rejected_count", 0)

        text = (
            "🔬 Research Database — Resumen\n\n"
            f"• Total Experimentos: {tot}\n"
            f"• Promocionados: {prom} (PROMOTED)\n"
            f"• Candidatos: {cand} (CANDIDATE)\n"
            f"• Rechazados: {rej} (REJECTED)\n\n"
        )
        recent = res.get("recent_experiments", [])
        if recent:
            text += "Experimentos Recientes:\n"
            for exp in recent[:3]:
                st = exp.get("decision_status", "DRAFT")
                pf = exp.get("best_profit_factor")
                pf_str = f"PF: {pf:.2f}" if pf else "PF: —"
                text += f"• {exp.get('title')} ({exp.get('symbol')}) — {st} | {pf_str}\n"

        await self._send_response(session, chat_id, text)

    async def _cmd_autosignals(self, session: aiohttp.ClientSession, chat_id: int, mode: str):
        if self.bot_service:
            res = self.bot_service.toggle_autosignals(mode)
        else:
            res = await asyncio.to_thread(self.trading_client.toggle_autosignals, mode)

        enabled = res.get("autosignals_enabled", True)
        st_text = "✅ ACTIVADA" if enabled else "⏸ DESACTIVADA"
        await self._send_response(session, chat_id, f"⚡ Generación automática de señales: {st_text}")

    async def _cmd_health(self, session: aiohttp.ClientSession, chat_id: int):
        if self.bot_service:
            h = self.bot_service.get_health_status()
        else:
            h = await asyncio.to_thread(self.trading_client.get_health)

        health_data = h.get("health", h)
        mt5_status = "ONLINE" if (h.get("mt5_connected") or health_data.get("mt5_connected")) else "OFFLINE"
        db_data = health_data.get("database", {})
        proc_data = health_data.get("process", {})

        text = (
            "🩺 LastEdge — Diagnóstico Técnico de Salud\n\n"
            f"• MT5 Terminal: {mt5_status}\n"
            f"• SQLite DB: WAL Mode ({db_data.get('size_mb', 0.1)} MB)\n"
            f"• CPU Process: {proc_data.get('cpu_percent', 0.0)}%\n"
            f"• RAM Process: {proc_data.get('memory_mb', 0.0):.1f} MB\n"
            f"• Hilos Activos: {proc_data.get('num_threads', 1)}\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_version(self, session: aiohttp.ClientSession, chat_id: int):
        text = (
            "📦 LastEdge — Información de Despliegue\n\n"
            "• Plataforma: LastEdge Trading Suite v1.0.0\n"
            "• Arquitectura: Desacoplada (Fast Probes + REST Gateway)\n"
            f"• Python: v{sys.version.split()[0]}\n"
            "• Estado: Producción Ready\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_logs(self, session: aiohttp.ClientSession, chat_id: int):
        try:
            log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
            log_files = [os.path.join(log_dir, f) for f in os.listdir(log_dir) if f.endswith(".txt")]
            if not log_files:
                await self._send_response(session, chat_id, "ℹ️ No hay registros recientes.")
                return

            latest_log = max(log_files, key=os.path.getmtime)
            with open(latest_log, "r", encoding="utf-8", errors="ignore") as f:
                lines = [l.strip() for l in f.readlines() if l.strip()]

            recent = lines[-6:] if lines else ["Sin eventos."]
            text = "📋 Registros Recientes:\n\n" + "\n".join(recent)
            await self._send_response(session, chat_id, text[:4000])
        except Exception as e:
            await self._send_response(session, chat_id, f"⚠️ Error leyendo logs: {e}")
