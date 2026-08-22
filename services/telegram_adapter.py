"""
TelegramAdapter — Adaptador de Telegram para LastEdge (P2.5)
============================================================
Adaptador asíncrono y liviano para Telegram que consume `BotService`
sin duplicar lógica de negocio.

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
import time
import logging
import asyncio
from typing import Optional, Dict, Any, List
import aiohttp

from services.clients.trading_client import get_trading_client, TradingClient

logger = logging.getLogger(__name__)

class TelegramAdapter:
    """Adaptador asíncrono para el bot de Telegram."""

    def __init__(self, bot_service: Optional[Any] = None, trading_client: Optional[TradingClient] = None):
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.authorized_chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.authorized_user_id = os.getenv("TELEGRAM_AUTHORIZED_USER_ID")
        self.bot_service = bot_service
        self.trading_client = trading_client or get_trading_client()
        self.last_update_id = 0
        self.is_running = False

    def is_configured(self) -> bool:
        """Indica si las credenciales de Telegram están presentes."""
        return bool(self.token)

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

        async with aiohttp.ClientSession(connector=connector) as session:
            while self.is_running:
                try:
                    url = f"https://api.telegram.org/bot{self.token}/getUpdates"
                    params = {"offset": self.last_update_id + 1, "timeout": 10}
                    async with session.get(url, params=params) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if data.get("ok") and data.get("result"):
                                for update in data["result"]:
                                    self.last_update_id = update["update_id"]
                                    await self._process_update(session, update)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"[TelegramAdapter] Error en polling loop: {e}")
                    await asyncio.sleep(5)

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
            await self._send_response(session, chat_id, "⛔ *No autorizado para controlar LastEdge.*")
            return

        # Enrutamiento de Comandos
        parts = text.split()
        command = parts[0].lower()
        args = parts[1:]

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
            await self._send_response(session, chat_id, f"🏓 *Pong!* Latencia de respuesta: `{elapsed_ms} ms`")

    async def _send_response(self, session: aiohttp.ClientSession, chat_id: int, text: str):
        """Envía una respuesta formateada en Markdown a Telegram."""
        try:
            url = f"https://api.telegram.org/bot{self.token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
            }
            async with session.post(url, json=payload, timeout=5) as resp:
                if resp.status != 200:
                    err_text = await resp.text()
                    logger.error(f"[TelegramAdapter] Error al enviar mensaje: {err_text}")
        except Exception as e:
            logger.error(f"[TelegramAdapter] Error enviando respuesta: {e}")

    # ── Manejadores de Comandos ──────────────────────────────────────────────

    async def _cmd_help(self, session: aiohttp.ClientSession, chat_id: int):
        help_text = (
            "⚡ *LastEdge — Bot de Telegram*\n\n"
            "*Comandos Núcleo:*\n"
            "• /status — Estado del bot, uptime, MT5 y noticias\n"
            "• /positions — Posiciones abiertas en MT5\n"
            "• /close\\_position <ticket> — Cierra una posición\n"
            "• /equity — Balance, equity y margen\n"
            "• /risk — Telemetría de Risk Engine v2\n"
            "• /journal — Diario de ejecución a 30 días\n"
            "• /research — Resumen de la Research Database\n"
            "• /autosignals [on/off] — Control de auto-ejecución\n\n"
            "*Comandos Técnicos:*\n"
            "• /health — Diagnóstico de infraestructura (CPU/RAM/DBs)\n"
            "• /version — Información de versión y Git commit\n"
            "• /logs — Últimos eventos o errores registrados\n"
            "• /ping — Prueba de latencia de respuesta\n"
        )
        await self._send_response(session, chat_id, help_text)

    async def _cmd_status(self, session: aiohttp.ClientSession, chat_id: int):
        st = self.bot_service.get_system_status()
        mt5_st = "🟢 Conectado" if st["mt5_connected"] else "🔴 Desconectado"
        cb = st["circuit_breaker"]
        cb_st = "🟢 Activo" if cb.get("can_trade", True) else "🔴 Pausado"

        text = (
            "⚡ *LastEdge — Estado del Bot*\n\n"
            f"• *Estado:* `{st['system_status']}`\n"
            f"• *Uptime:* `{st['uptime_formatted']}`\n"
            f"• *MT5 Broker:* {mt5_st}\n"
            f"• *Cuenta:* `{st['account_number'] or '—'}`\n"
            f"• *Circuit Breaker:* {cb_st} (×{cb.get('risk_multiplier', 1.0):.1f})\n"
            f"• *Autosignals:* {'✅ Activo' if st['autosignals_enabled'] else '⏸ Desactivado'}\n"
            f"• *Pares Monitoreados:* `{', '.join(st.get('monitored_symbols', []))}`\n"
            f"• *Filtro Noticias:* {st.get('news_indicator', '🟢 OK')}\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_positions(self, session: aiohttp.ClientSession, chat_id: int):
        positions = self.bot_service.get_open_positions()
        if not positions:
            await self._send_response(session, chat_id, "ℹ️ *No hay posiciones abiertas actualmente en MT5.*")
            return

        text = f"📊 *Posiciones Abiertas en MT5 ({len(positions)})*\n\n"
        for p in positions:
            pnl_emoji = "🟢" if p["profit"] >= 0 else "🔴"
            text += (
                f"• *#{p['ticket']} — {p['symbol']} ({p['type']})*\n"
                f"  Lotes: `{p['volume']:.2f}` | Entrada: `{p['open_price']:.5f}`\n"
                f"  P&L: {pnl_emoji} *{p['profit']:+.2f} €*\n\n"
            )
        await self._send_response(session, chat_id, text)

    async def _cmd_close_position(self, session: aiohttp.ClientSession, chat_id: int, args: List[str]):
        if not args or not args[0].isdigit():
            await self._send_response(session, chat_id, "⚠️ Uso: `/close_position <ticket>`")
            return

        ticket = int(args[0])
        res = self.bot_service.close_position(ticket)
        msg = f"✅ {res['message']}" if res["ok"] else f"❌ {res['message']}"
        await self._send_response(session, chat_id, msg)

    async def _cmd_equity(self, session: aiohttp.ClientSession, chat_id: int):
        acc = self.bot_service.get_account_equity()
        if not acc.get("ok"):
            await self._send_response(session, chat_id, f"❌ Error: {acc.get('message')}")
            return

        pnl = acc["floating_pnl"]
        pnl_emoji = "🟢" if pnl >= 0 else "🔴"

        text = (
            "💰 *Balance & Equity — MT5 Account*\n\n"
            f"• *Balance:* *{acc['balance']:,.2f} {acc['currency']}*\n"
            f"• *Equity:* *{acc['equity']:,.2f} {acc['currency']}*\n"
            f"• *P&L Flotante:* {pnl_emoji} *{pnl:+.2f} {acc['currency']}*\n"
            f"• *Margen Usado:* `{acc['margin']:,.2f} {acc['currency']}`\n"
            f"• *Margen Libre:* `{acc['free_margin']:,.2f} {acc['currency']}`\n"
            f"• *Nivel de Margen:* `{acc['margin_level']:.1f}%`\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_risk(self, session: aiohttp.ClientSession, chat_id: int):
        rk = self.bot_service.get_risk_telemetry()
        cb = rk["circuit_breaker"]
        status_str = "🟢 OPERATIVO" if rk["can_trade"] else "🔴 PAUSADO (Circuit Breaker)"

        text = (
            "🛡️ *Risk Engine v2 — Telemetría*\n\n"
            f"• *Estado:* *{status_str}*\n"
            f"• *Multiplicador Riesgo:* `×{cb.get('risk_multiplier', 1.0):.1f}`\n"
            f"• *Rachas:* Perdidas `{cb.get('consecutive_losses', 0)}` | Ganadas `{cb.get('consecutive_wins', 0)}`\n"
            f"• *Posiciones:* `{rk['open_positions_count']}` ({rk['total_exposure_lots']} lotes)\n"
            f"• *P&L Flotante Total:* *{rk['total_floating_pnl']:+.2f} €*\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_journal(self, session: aiohttp.ClientSession, chat_id: int):
        res = self.bot_service.get_journal_summary(days=30)
        stats = res.get("stats", {})

        text = (
            "📖 *Diario de Ejecución (30 Días)*\n\n"
            f"• *Total Órdenes:* `{stats.get('total_orders', 0)}`\n"
            f"• *Tasa de Rechazo:* `{stats.get('rejection_rate_pct', 0.0):.1f}%`\n"
            f"• *Spread Medio:* `{stats.get('avg_spread_pips', 0.0):.1f} pips`\n"
            f"• *Latencia Media:* `{stats.get('avg_latency_ms', 0.0):.0f} ms`\n"
            f"• *Slippage Medio:* `{stats.get('avg_slippage_pips', 0.0):+.2f} pips`\n"
            f"• *Costo Slippage:* `{stats.get('total_slippage_cost_eur', 0.0):+.2f} €`\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_research(self, session: aiohttp.ClientSession, chat_id: int):
        res = self.bot_service.get_research_summary()
        text = (
            "🔬 *Research Database — Resumen*\n\n"
            f"• *Total Experimentos:* `{res['total_experiments']}`\n"
            f"• *Promocionados:* `{res['promoted_count']}` (PROMOTED)\n"
            f"• *Candidatos:* `{res['candidates_count']}` (CANDIDATE)\n"
            f"• *Rechazados:* `{res['rejected_count']}` (REJECTED)\n\n"
        )
        recent = res.get("recent_experiments", [])
        if recent:
            text += "*Experimentos Recientes:*\n"
            for exp in recent[:3]:
                st = exp.get("decision_status", "DRAFT")
                pf = exp.get("best_profit_factor")
                pf_str = f"PF: {pf:.2f}" if pf else "PF: —"
                text += f"• *{exp.get('title')}* ({exp.get('symbol')}) — `{st}` | {pf_str}\n"

        await self._send_response(session, chat_id, text)

    async def _cmd_autosignals(self, session: aiohttp.ClientSession, chat_id: int, mode: str):
        res = self.bot_service.toggle_autosignals(mode)
        st_text = "✅ *ACTIVADA*" if res["autosignals_enabled"] else "⏸ *DESACTIVADA*"
        await self._send_response(session, chat_id, f"⚡ Generación automática de señales: {st_text}")

    async def _cmd_health(self, session: aiohttp.ClientSession, chat_id: int):
        h = self.bot_service.get_health_status()
        text = (
            "🩺 *LastEdge — Diagnóstico Técnico de Salud*\n\n"
            f"• *MT5 Broker:* `{h['mt5']['status']}`\n"
            f"• *SQLite DB:* `{h['sqlite']['status']}` ({h['sqlite']['size_kb']} KB)\n"
            f"• *Research DB:* `{h['research_db']['status']}` ({h['research_db']['experiments']} exp)\n"
            f"• *Web Dashboard:* `{h['dashboard']['status']}` (Port {h['dashboard']['port']})\n"
            f"• *Mobile API:* `{h['mobile_api']['status']}` (Port {h['mobile_api']['port']})\n"
            f"• *Recursos:* CPU `{h['resources']['cpu_percent']}%` | RAM `{h['resources']['ram_percent']}%` ({h['resources']['ram_used_mb']} MB)\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_version(self, session: aiohttp.ClientSession, chat_id: int):
        v = self.bot_service.get_version_info()
        text = (
            "📦 *LastEdge — Información de Despliegue*\n\n"
            f"• *Plataforma:* *{v['platform_name']}*\n"
            f"• *Versión:* `v{v['version']}`\n"
            f"• *Git Commit:* `{v['git_commit']}` (`{v['git_branch']}`)\n"
            f"• *Python:* `v{v['python_version']}` | *DB Schema:* `{v['db_schema_version']}`\n"
            f"• *Fecha Build:* `{v['build_date']}`\n"
        )
        await self._send_response(session, chat_id, text)

    async def _cmd_logs(self, session: aiohttp.ClientSession, chat_id: int):
        logs = self.bot_service.get_recent_logs(count=6)
        if not logs:
            await self._send_response(session, chat_id, "ℹ️ *No hay registros recientes.*")
            return

        text = "📋 *Registros Recientes del Sistema:*\n\n"
        for entry in logs:
            lvl = entry.get("level", "INFO")
            emoji = "🔴" if lvl == "ERROR" else ("⚠️" if lvl == "WARNING" else "🔹")
            text += f"{emoji} `[{entry.get('component')}]` {entry.get('message')}\n"
        await self._send_response(session, chat_id, text[:4000])
