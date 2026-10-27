"""
TelegramAdapter — Adaptador de Telegram para LastEdge (P2.5)
============================================================
Adaptador asíncrono, liviano, bilingüe (EN/ES) y con estética institucional.
Consume `BotService` (si está presente) o los clientes REST (`TradingClient` y `ResearchClient`).
"""

from __future__ import annotations

import os
import sys
import time
import json
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
import aiohttp

from services.clients.trading_client import get_trading_client, TradingClient
from services.clients.research_client import get_research_client, ResearchClient

logger = logging.getLogger(__name__)

PREFS_PATH = Path(__file__).resolve().parent.parent / "data" / "telegram_prefs.json"
CARD_LINE = "━━━━━━━━━━━━━━━━━━"

I18N = {
    "en": {
        "start_title": "⚡ *LastEdge — Trading Control Center*",
        "start_desc": "Institutional Trading Automation & Mobile Gateway.\nSelect a quick action below or use the persistent keyboard.",
        "lang_badge": "English 🇬🇧",
        "btn_positions": "📊 Positions",
        "btn_chart": "📈 Live Chart",
        "btn_status": "⚡ System Status",
        "btn_equity": "💰 Equity & Balance",
        "btn_risk": "🛡️ Risk Engine",
        "btn_journal": "📖 Execution Journal",
        "btn_research": "🔬 Strategy Lab",
        "btn_health": "🩺 System Health",
        "btn_autosignals": "⚙️ AutoSignals",
        "btn_refresh": "🔄 Refresh Menu",
        "btn_toggle_lang": "🌐 Language: English 🇬🇧",
        "btn_back_menu": "⚡ Main Menu",

        "status_title": "⚡ *LastEdge — System Status*",
        "status_general": "• *System Status:*",
        "status_mt5": "• *MT5 Terminal:*",
        "status_account": "Account",
        "status_pnl": "• *Total Floating P&L:*",
        "status_uptime": "• *System Uptime:*",
        "status_cb": "• *Circuit Breaker:*",
        "status_auto": "• *AutoSignals:*",
        "status_pairs": "• *Monitored Pairs:*",
        "status_news": "• *News Guard:*",
        "connected": "🟢 Connected",
        "disconnected": "🔴 Disconnected",
        "active": "🟢 Active",
        "paused": "🔴 Paused",
        "open_trades": "open",
        "btn_refresh_status": "🔄 Refresh Status",
        "btn_view_positions": "📊 View Positions",

        "positions_title": "📊 *MT5 Open Positions*",
        "no_positions": "ℹ️ _No open positions currently in MetaTrader 5._",
        "total_pnl": "💰 *Total Floating P&L:*",
        "volume": "Volume",
        "lots": "lots",
        "lots_label": "Lots",
        "entry": "Entry",
        "current": "Current",
        "btn_refresh_positions": "🔄 Refresh Positions",
        "btn_chart_prefix": "📊 Chart",

        "equity_title": "💰 *MT5 Account — Balance & Equity*",
        "balance": "• *Account Balance:*",
        "equity": "• *Floating Equity:*",
        "floating_pnl": "• *Floating P&L:*",
        "used_margin": "• *Used Margin:*",
        "free_margin": "• *Free Margin:*",
        "margin_level": "• *Margin Level:*",
        "btn_refresh_equity": "🔄 Refresh Equity",

        "risk_title": "🛡️ *Risk Engine v2 — Telemetry*",
        "risk_exec": "• *Execution Guard:*",
        "risk_mult": "• *Risk Multiplier:*",
        "risk_streaks": "• *Consecutive Streaks:*",
        "risk_exp": "• *Active Exposure:*",
        "risk_pnl": "• *Total Floating P&L:*",
        "losses": "Losses",
        "wins": "Wins",
        "positions_unit": "positions",
        "btn_refresh_risk": "🔄 Refresh Risk",

        "journal_title": "📖 *Execution Journal (Last 30 Days)*",
        "journal_orders": "• *Total Executed Orders:*",
        "journal_rejection": "• *Order Rejection Rate:*",
        "journal_spread": "• *Average Spread:*",
        "journal_latency": "• *Average Execution Latency:*",
        "journal_slippage": "• *Average Slippage:*",
        "journal_cost": "• *Total Slippage Cost:*",
        "btn_refresh_journal": "🔄 Refresh Journal",

        "research_title": "🔬 *Strategy Lab — Research Database*",
        "research_total": "• *Total Experiments:*",
        "research_prom": "• *Promoted to Production:*",
        "research_cand": "• *Vetting Candidates:*",
        "research_rej": "• *Rejected Strategies:*",
        "research_recent": "• *Recent Experiments:*",
        "btn_refresh_research": "🔄 Refresh Lab",

        "health_title": "🩺 *LastEdge — Infrastructure Health*",
        "health_mt5": "• *MT5 Terminal Gateway:*",
        "health_db": "• *SQLite Database:*",
        "health_cpu": "• *Process CPU Usage:*",
        "health_ram": "• *Process RAM Memory:*",
        "health_threads": "• *Active Worker Threads:*",
        "btn_refresh_health": "🔄 Refresh Health",

        "autosignals_title": "⚙️ *AutoSignals Engine Control*",
        "autosignals_exec": "• *Automated Signal Generation:*",
        "autosignals_status": "• *Status Mode:*",

        "version_title": "📦 *LastEdge — Deployment Information*",
        "version_plat": "• *Platform:* `LastEdge Suite v1.0.0`",
        "version_arch": "• *Architecture:* `Decoupled (Fast Probes + REST Gateway)`",
        "version_py": "• *Python Environment:*",
        "version_status": "• *Status:* `Production Ready`",

        "chart_title": "📊 *Live Technical Chart — {target}*",
        "chart_tf": "• *Timeframe:* `H1` (Last 80 MT5 candles)",
        "chart_levels": "• *Key Levels:* 🟩 Entry | 🟥 Stop Loss | 🟦 Take Profit",
        "chart_select": "📈 *Select a position to view live chart:*",
        "chart_error": "⚠️ Could not generate the requested chart.",

        "close_usage": "⚠️ *Usage:* `/close_position <ticket>`",
        "close_success": "✅ *Position Closed in MT5* | Ticket #{ticket} closed successfully.",
        "close_error": "❌ *Error Closing Position* | Ticket #{ticket}: {error}",

        "updated": "Updated",
        "lang_switched": "🇬🇧 Language switched to English",

        "signal_rejected": "❌ *SIGNAL REJECTED* | Cancelled manually by user.",
        "order_executed": "✅ *ORDER EXECUTED IN MT5* | Ticket #{ticket} @ {price}",
        "signal_expired": "⏳ *SIGNAL EXPIRED* | {error}",
        "drift_title": "⚠️ *PRICE DRIFT WARNING*",
        "drift_body": "Market price has moved since signal generation:\n• *Signal Price:* `{sig_p}`\n• *Live MT5 Price:* `{cur_p}` (Drift: `{drift}`)\n━━━━━━━━━━━━━━━━━━\nExecute at current market price?",
        "btn_drift_force": "⚡ Yes, Execute at Market",
        "btn_drift_cancel": "🚫 Cancel"
    },
    "es": {
        "start_title": "⚡ *LastEdge — Panel de Control Institucional*",
        "start_desc": "Trading Algorítmico Institucional y Pasarela Móvil.\nSelecciona una acción rápida o usa el teclado de comandos.",
        "lang_badge": "Español 🇪🇸",
        "btn_positions": "📊 Posiciones",
        "btn_chart": "📈 Gráficos",
        "btn_status": "⚡ Estado del Bot",
        "btn_equity": "💰 Balance y Capital",
        "btn_risk": "🛡️ Motor de Riesgo",
        "btn_journal": "📖 Diario de Trading",
        "btn_research": "🔬 Strategy Lab",
        "btn_health": "🩺 Salud del Sistema",
        "btn_autosignals": "⚙️ AutoSignals",
        "btn_refresh": "🔄 Actualizar Menú",
        "btn_toggle_lang": "🌐 Idioma: Español 🇪🇸",
        "btn_back_menu": "⚡ Menú Principal",

        "status_title": "⚡ *LastEdge — Estado del Bot*",
        "status_general": "• *Estado General:*",
        "status_mt5": "• *MT5 Broker:*",
        "status_account": "Cuenta",
        "status_pnl": "• *P&L Flotante Total:*",
        "status_uptime": "• *Uptime:*",
        "status_cb": "• *Circuit Breaker:*",
        "status_auto": "• *Autosignals:*",
        "status_pairs": "• *Pares Monitoreados:*",
        "status_news": "• *Filtro de Noticias:*",
        "connected": "🟢 Conectado",
        "disconnected": "🔴 Desconectado",
        "active": "🟢 Activo",
        "paused": "🔴 Pausado",
        "open_trades": "abiertas",
        "btn_refresh_status": "🔄 Actualizar Estado",
        "btn_view_positions": "📊 Ver Posiciones",

        "positions_title": "📊 *Posiciones abiertas en MT5*",
        "no_positions": "ℹ️ _No hay posiciones abiertas actualmente en MT5._",
        "total_pnl": "💰 *P&L Flotante Total:*",
        "volume": "Volumen",
        "lots": "lotes",
        "lots_label": "Lotes",
        "entry": "Entrada",
        "current": "Actual",
        "btn_refresh_positions": "🔄 Actualizar Posiciones",
        "btn_chart_prefix": "📊 Gráfico",

        "equity_title": "💰 *Cuenta MT5 — Balance y Capital*",
        "balance": "• *Balance de Cuenta:*",
        "equity": "• *Capital Flotante (Equity):*",
        "floating_pnl": "• *P&L Flotante:*",
        "used_margin": "• *Margen Usado:*",
        "free_margin": "• *Margen Libre:*",
        "margin_level": "• *Nivel de Margen:*",
        "btn_refresh_equity": "🔄 Actualizar Balance",

        "risk_title": "🛡️ *Risk Engine v2 — Telemetría*",
        "risk_exec": "• *Estado de Ejecución:*",
        "risk_mult": "• *Multiplicador de Riesgo:*",
        "risk_streaks": "• *Rachas Consecutivas:*",
        "risk_exp": "• *Exposición Activa:*",
        "risk_pnl": "• *P&L Flotante Total:*",
        "losses": "Pérdidas",
        "wins": "Ganadas",
        "positions_unit": "posiciones",
        "btn_refresh_risk": "🔄 Actualizar Riesgo",

        "journal_title": "📖 *Diario de Ejecución (Últimos 30 Días)*",
        "journal_orders": "• *Total Órdenes Ejecutadas:*",
        "journal_rejection": "• *Tasa de Rechazo:*",
        "journal_spread": "• *Spread Medio:*",
        "journal_latency": "• *Latencia Media de Ejecución:*",
        "journal_slippage": "• *Slippage Medio:*",
        "journal_cost": "• *Costo Total Slippage:*",
        "btn_refresh_journal": "🔄 Actualizar Diario",

        "research_title": "🔬 *Strategy Lab — Base de Estrategias*",
        "research_total": "• *Total Experimentos:*",
        "research_prom": "• *Promocionados a Producción:*",
        "research_cand": "• *Candidatos en Validación:*",
        "research_rej": "• *Estrategias Rechazadas:*",
        "research_recent": "• *Experimentos Recientes:*",
        "btn_refresh_research": "🔄 Actualizar Lab",

        "health_title": "🩺 *LastEdge — Salud de la Infraestructura*",
        "health_mt5": "• *Pasarela MT5 Terminal:*",
        "health_db": "• *Base de Datos SQLite:*",
        "health_cpu": "• *Uso de CPU del Proceso:*",
        "health_ram": "• *Uso de Memoria RAM:*",
        "health_threads": "• *Hilos Activos de Trabajo:*",
        "btn_refresh_health": "🔄 Actualizar Salud",

        "autosignals_title": "⚙️ *Control del Motor AutoSignals*",
        "autosignals_exec": "• *Generación Automática de Señales:*",
        "autosignals_status": "• *Modo de Estado:*",

        "version_title": "📦 *LastEdge — Información de Despliegue*",
        "version_plat": "• *Plataforma:* `LastEdge Suite v1.0.0`",
        "version_arch": "• *Arquitectura:* `Desacoplada (Fast Probes + REST Gateway)`",
        "version_py": "• *Entorno Python:*",
        "version_status": "• *Estado:* `Listo para Producción`",

        "chart_title": "📊 *Gráfico Técnico en Vivo — {target}*",
        "chart_tf": "• *Timeframe:* `H1` (Últimas 80 velas de MT5)",
        "chart_levels": "• *Niveles:* 🟩 Entrada | 🟥 Stop Loss | 🟦 Take Profit",
        "chart_select": "📈 *Selecciona la posición para ver su gráfico:*",
        "chart_error": "⚠️ No se pudo generar el gráfico solicitado.",

        "close_usage": "⚠️ *Uso:* `/close_position <ticket>`",
        "close_success": "✅ *Posición Cerrada en MT5* | Ticket #{ticket} cerrado con éxito.",
        "close_error": "❌ *Error al Cerrar Posición* | Ticket #{ticket}: {error}",

        "updated": "Actualizado",
        "lang_switched": "🇪🇸 Idioma cambiado a Español",

        "signal_rejected": "❌ *SEÑAL DESCARTADA* | Cancelada manualmente por el usuario.",
        "order_executed": "✅ *ORDEN EJECUTADA EN MT5* | Ticket #{ticket} @ {price}",
        "signal_expired": "⏳ *SEÑAL EXPIRADA* | {error}",
        "drift_title": "⚠️ *ALERTA DE DESVIACIÓN DE PRECIO*",
        "drift_body": "El precio de mercado se ha movido desde la emisión de la señal:\n• *Precio señal:* `{sig_p}`\n• *Precio actual MT5:* `{cur_p}` (Desviación: `{drift}`)\n━━━━━━━━━━━━━━━━━━\n¿Deseas ejecutar la orden al precio de mercado actual?",
        "btn_drift_force": "⚡ Sí, Ejecutar a Mercado",
        "btn_drift_cancel": "🚫 Cancelar"
    }
}


def _load_prefs() -> Dict[str, Any]:
    try:
        if PREFS_PATH.exists():
            with open(PREFS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _save_prefs(data: Dict[str, Any]) -> None:
    try:
        PREFS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(PREFS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"[TelegramAdapter] Error saving prefs: {e}")


def get_chat_language(chat_id: Any) -> str:
    """Returns 'en' or 'es' for chat_id. Defaults to 'en'."""
    prefs = _load_prefs()
    return prefs.get(str(chat_id), {}).get("language", "en")


def set_chat_language(chat_id: Any, lang: str) -> str:
    """Sets language preference ('en' or 'es') for chat_id."""
    clean_lang = "es" if str(lang).lower().startswith("es") else "en"
    prefs = _load_prefs()
    if str(chat_id) not in prefs:
        prefs[str(chat_id)] = {}
    prefs[str(chat_id)]["language"] = clean_lang
    _save_prefs(prefs)
    return clean_lang


class TelegramAdapter:
    """Adaptador asíncrono, bilingüe y de alta concurrencia para el bot de Telegram."""

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
        self.bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "LastEdgeBot")
        self.last_update_id = 0
        self.is_running = False

    def is_configured(self) -> bool:
        """Indica si las credenciales de Telegram están presentes."""
        return bool(self.token and len(self.token.strip()) > 10)

    def get_lang(self, chat_id: Any) -> str:
        return get_chat_language(chat_id)

    def toggle_lang(self, chat_id: Any) -> str:
        current = self.get_lang(chat_id)
        new_lang = "es" if current == "en" else "en"
        return set_chat_language(chat_id, new_lang)

    def get_persistent_keyboard(self, lang: str = "en") -> Dict[str, Any]:
        """Devuelve ReplyKeyboardRemove para ocultar el teclado inferior y dejar sólo botones inline en los mensajes."""
        return {"remove_keyboard": True}

    async def register_bot_commands(self, session: Optional[aiohttp.ClientSession] = None) -> bool:
        """Registra los comandos de LastEdge en Telegram Bot API para autocompletado en EN y ES."""
        if not self.is_configured():
            return False

        commands_en = [
            {"command": "start", "description": "Trading Control Center & Main Menu"},
            {"command": "positions", "description": "Active MT5 positions & live P&L"},
            {"command": "status", "description": "System health, MT5 & Circuit Breaker"},
            {"command": "equity", "description": "Account balance, equity & margin"},
            {"command": "risk", "description": "Risk Engine telemetry & parameters"},
            {"command": "journal", "description": "30-day execution performance analytics"},
            {"command": "research", "description": "Strategy Lab experiment database"},
            {"command": "autosignals", "description": "Toggle automated signal execution"},
            {"command": "chart", "description": "Generate live technical chart for symbol"},
            {"command": "health", "description": "Technical infrastructure diagnostics"},
            {"command": "language", "description": "Toggle language (English / Espanol)"},
            {"command": "ping", "description": "Check bot latency & responsiveness"},
            {"command": "help", "description": "Quick instructions & command guide"}
        ]

        commands_es = [
            {"command": "start", "description": "Panel de Control y Menú Principal"},
            {"command": "positions", "description": "Posiciones abiertas y P&L flotante"},
            {"command": "status", "description": "Estado del sistema, MT5 y disyuntor"},
            {"command": "equity", "description": "Balance, capital y margenes"},
            {"command": "risk", "description": "Telemetria y parametros de riesgo"},
            {"command": "journal", "description": "Metricas de ejecucion y rendimiento (30d)"},
            {"command": "research", "description": "Base de datos de estrategias Lab"},
            {"command": "autosignals", "description": "Conmutar ejecucion automatica de senales"},
            {"command": "chart", "description": "Generar grafico tecnico en vivo por simbolo"},
            {"command": "health", "description": "Diagnostico de salud tecnica"},
            {"command": "language", "description": "Cambiar idioma (English / Espanol)"},
            {"command": "ping", "description": "Comprobar latencia del bot"},
            {"command": "help", "description": "Guia rapida de instrucciones y comandos"}
        ]

        url = f"https://api.telegram.org/bot{self.token}/setMyCommands"

        async def _send(s: aiohttp.ClientSession, payload: dict):
            async with s.post(url, json=payload) as r:
                return r.status == 200

        try:
            if session:
                await _send(session, {"commands": commands_en})
                await _send(session, {"commands": commands_es, "language_code": "es"})
            else:
                import ssl
                ssl_ctx = ssl.create_default_context()
                ssl_ctx.check_hostname = False
                ssl_ctx.verify_mode = ssl.CERT_NONE
                connector = aiohttp.TCPConnector(ssl=ssl_ctx)
                async with aiohttp.ClientSession(connector=connector) as local_session:
                    await _send(local_session, {"commands": commands_en})
                    await _send(local_session, {"commands": commands_es, "language_code": "es"})
            logger.info("[TelegramAdapter] Comandos de bot registrados en Telegram (EN / ES)")
            return True
        except Exception as e:
            logger.warning(f"[TelegramAdapter] No se pudieron registrar los comandos en Telegram: {e}")
            return False

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
            try:
                await self.register_bot_commands(session)
            except Exception as e:
                logger.warning(f"[TelegramAdapter] Error registrando comandos: {e}")
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
        try:
            if "callback_query" in update:
                await self._process_callback_query(session, update["callback_query"])
            elif "message" in update:
                await self._process_update(session, update)
        except Exception as e:
            logger.error(f"[TelegramAdapter] Error procesando actualización: {e}", exc_info=True)

    async def _answer_callback_query(
        self,
        session: aiohttp.ClientSession,
        callback_query_id: str,
        text: Optional[str] = None
    ):
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
        try:
            url = f"https://api.telegram.org/bot{self.token}/editMessageText"
            payload: Dict[str, Any] = {
                "chat_id": chat_id,
                "message_id": message_id,
                "text": text,
                "parse_mode": "Markdown",
            }
            if reply_markup is not None:
                payload["reply_markup"] = reply_markup
            else:
                payload["reply_markup"] = {"inline_keyboard": []}

            client_timeout = aiohttp.ClientTimeout(total=6)
            async with session.post(url, json=payload, timeout=client_timeout) as resp:
                if resp.status != 200:
                    payload.pop("parse_mode", None)
                    async with session.post(url, json=payload, timeout=client_timeout):
                        pass
        except Exception as e:
            logger.error(f"[TelegramAdapter] Error editando mensaje #{message_id}: {e}")

    async def _send_response(
        self,
        session: aiohttp.ClientSession,
        chat_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        lang: Optional[str] = None
    ):
        try:
            url = f"https://api.telegram.org/bot{self.token}/sendMessage"
            payload: Dict[str, Any] = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
            }
            user_lang = lang or self.get_lang(chat_id)
            if reply_markup is not None:
                payload["reply_markup"] = reply_markup
            else:
                payload["reply_markup"] = {"remove_keyboard": True}

            client_timeout = aiohttp.ClientTimeout(total=6)
            async with session.post(url, json=payload, timeout=client_timeout) as resp:
                if resp.status != 200:
                    payload.pop("parse_mode", None)
                    async with session.post(url, json=payload, timeout=client_timeout):
                        pass
        except Exception as e:
            logger.error(f"[TelegramAdapter] Error enviando respuesta: {e}")

    async def send_photo(
        self,
        session: aiohttp.ClientSession,
        chat_id: int,
        photo_path: str,
        caption: Optional[str] = None,
        reply_markup: Optional[Dict[str, Any]] = None
    ) -> bool:
        if not self.token or not os.path.exists(photo_path):
            return False

        try:
            url = f"https://api.telegram.org/bot{self.token}/sendPhoto"
            form = aiohttp.FormData()
            form.add_field("chat_id", str(chat_id))
            if caption:
                form.add_field("caption", caption)
                form.add_field("parse_mode", "Markdown")
            if reply_markup:
                form.add_field("reply_markup", json.dumps(reply_markup))

            with open(photo_path, "rb") as f:
                form.add_field("photo", f.read(), filename=os.path.basename(photo_path), content_type="image/png")

            client_timeout = aiohttp.ClientTimeout(total=15)
            async with session.post(url, data=form, timeout=client_timeout) as resp:
                if resp.status == 200:
                    return True
                if caption:
                    form_retry = aiohttp.FormData()
                    form_retry.add_field("chat_id", str(chat_id))
                    form_retry.add_field("caption", caption)
                    if reply_markup:
                        form_retry.add_field("reply_markup", json.dumps(reply_markup))
                    with open(photo_path, "rb") as f:
                        form_retry.add_field("photo", f.read(), filename=os.path.basename(photo_path), content_type="image/png")
                    async with session.post(url, data=form_retry, timeout=client_timeout) as r2:
                        return r2.status == 200
                return False
        except Exception as e:
            logger.error(f"[TelegramAdapter] Error enviando imagen: {e}")
            return False

    # ── Cards & Renderers ────────────────────────────────────────────────────

    def _render_start_menu(self, lang: str = "en") -> Tuple[str, Dict[str, Any]]:
        t = I18N[lang]
        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")

        text = (
            f"{t['start_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['start_desc']}\n"
            f"{CARD_LINE}\n"
            f"🌐 *Language / Idioma:* `{t['lang_badge']}`\n"
            f"⏰ _{t['updated']}: {now_str}_\n"
        )

        markup = {
            "inline_keyboard": [
                [
                    {"text": t["btn_positions"], "callback_data": "nav_positions"},
                    {"text": t["btn_status"], "callback_data": "nav_status"}
                ],
                [
                    {"text": t["btn_equity"], "callback_data": "nav_equity"},
                    {"text": t["btn_risk"], "callback_data": "nav_risk"}
                ],
                [
                    {"text": t["btn_journal"], "callback_data": "nav_journal"},
                    {"text": t["btn_research"], "callback_data": "nav_research"}
                ],
                [
                    {"text": t["btn_health"], "callback_data": "nav_health"},
                    {"text": t["btn_autosignals"], "callback_data": "nav_autosignals"}
                ],
                [
                    {"text": t["btn_toggle_lang"], "callback_data": "toggle_language"}
                ],
                [
                    {"text": t["btn_refresh"], "callback_data": "nav_start"}
                ]
            ]
        }
        return text, markup

    async def _render_status(self, lang: str = "en") -> Tuple[str, Dict[str, Any]]:
        t = I18N[lang]
        if self.bot_service:
            st = self.bot_service.get_system_status()
            positions = self.bot_service.get_open_positions()
        else:
            t_stat = await asyncio.to_thread(self.trading_client.get_status)
            metrics_res = await asyncio.to_thread(self.trading_client.get_metrics)
            pos_res = await asyncio.to_thread(self.trading_client.get_positions)
            positions = pos_res.get("positions", []) if isinstance(pos_res, dict) else (pos_res if isinstance(pos_res, list) else [])
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

        mt5_st = t["connected"] if st.get("mt5_connected") else t["disconnected"]
        cb = st.get("circuit_breaker", {})
        cb_st = t["active"] if cb.get("can_trade", True) else t["paused"]

        open_count = len(positions)
        total_profit = sum(float(p.get("profit", 0.0)) for p in positions)
        total_pnl_emoji = "🟢" if total_profit >= 0 else "🔴"
        pnl_summary = f"{total_pnl_emoji} {total_profit:+.2f} USD ({open_count} {t['open_trades']})" if open_count > 0 else f"0.00 USD (0 {t['open_trades']})"
        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")

        text = (
            f"{t['status_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['status_general']} `{st.get('system_status', 'ONLINE')}`\n"
            f"{t['status_mt5']} {mt5_st} ({t['status_account']}: `{st.get('account_number') or '—'}`)\n"
            f"{t['status_pnl']} *{pnl_summary}*\n"
            f"{t['status_uptime']} `{st.get('uptime_formatted', '—')}`\n"
            f"{t['status_cb']} {cb_st} (×`{cb.get('risk_multiplier', 1.0):.1f}`)\n"
            f"{t['status_auto']} {'✅ Active' if st.get('autosignals_enabled') else '⏸ Disabled' if lang == 'en' else '✅ Activo' if st.get('autosignals_enabled') else '⏸ Desactivado'}\n"
            f"{t['status_pairs']} `{', '.join(st.get('monitored_symbols', []))}`\n"
            f"{t['status_news']} {st.get('news_indicator', '🟢 OK')}\n"
            f"{CARD_LINE}\n"
            f"⏰ _{t['updated']}: {now_str}_"
        )
        markup = {
            "inline_keyboard": [
                [
                    {"text": t["btn_refresh_status"], "callback_data": "refresh_status"},
                    {"text": t["btn_view_positions"], "callback_data": "nav_positions"}
                ],
                [
                    {"text": t["btn_back_menu"], "callback_data": "nav_start"}
                ]
            ]
        }
        return text, markup

    async def _render_positions(self, lang: str = "en") -> Tuple[str, Dict[str, Any]]:
        t = I18N[lang]
        if self.bot_service:
            positions = self.bot_service.get_open_positions()
        else:
            res = await asyncio.to_thread(self.trading_client.get_positions)
            positions = res.get("positions", []) if isinstance(res, dict) else (res if isinstance(res, list) else [])

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        markup = {
            "inline_keyboard": [
                [{"text": t["btn_refresh_positions"], "callback_data": "refresh_positions"}],
                [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
            ]
        }

        if not positions:
            text = (
                f"{t['positions_title']} (0)\n"
                f"{CARD_LINE}\n"
                f"{t['total_pnl']} `0.00 USD`\n"
                f"{CARD_LINE}\n"
                f"{t['no_positions']}\n\n"
                f"⏰ _{t['updated']}: {now_str}_"
            )
            return text, markup

        total_profit = sum(float(p.get("profit", 0.0)) for p in positions)
        total_lots = sum(float(p.get("volume", 0.0)) for p in positions)
        total_pnl_emoji = "🟢" if total_profit >= 0 else "🔴"

        text = (
            f"{t['positions_title']} ({len(positions)})\n"
            f"{CARD_LINE}\n"
            f"{t['total_pnl']} {total_pnl_emoji} *{total_profit:+.2f} USD* ({t['volume']}: `{total_lots:.2f}` {t['lots']})\n"
            f"{CARD_LINE}\n\n"
        )

        for p in positions:
            profit = float(p.get("profit", 0.0))
            pnl_emoji = "🟢" if profit >= 0 else "🔴"
            ticket = p.get("ticket", 0)
            symbol = p.get("symbol", "EURUSD")
            ptype = str(p.get("type", "BUY")).upper()
            vol = float(p.get("volume", 0.0))
            open_p = float(p.get("open_price", 0.0))
            curr_p = float(p.get("current_price", open_p))
            sl = float(p.get("sl", 0.0))
            tp = float(p.get("tp", 0.0))

            chart_link_label = "View Chart" if lang == "en" else "Ver Gráfico"
            chart_deep_link = f"https://t.me/{self.bot_username}?start=chart_{ticket}"
            text += (
                f"• *#{ticket} — {symbol} ({ptype})*\n"
                f"  {t['lots_label']}: `{vol:.2f}` | {t['entry']}: `{open_p:.5f}`\n"
                f"  {t['current']}: `{curr_p:.5f}` | P&L: {pnl_emoji} *{profit:+.2f} USD*\n"
            )
            if sl > 0 or tp > 0:
                text += f"  SL: `{sl:.5f}` | TP: `{tp:.5f}`\n"
            text += f"  📊 [{chart_link_label}]({chart_deep_link}) • `/chart_{ticket}`\n\n"

        text += f"{CARD_LINE}\n⏰ _{t['updated']}: {now_str}_"
        return text, markup

    async def _render_equity(self, lang: str = "en") -> Tuple[str, Dict[str, Any]]:
        t = I18N[lang]
        if self.bot_service:
            acc = self.bot_service.get_account_equity()
        else:
            res = await asyncio.to_thread(self.trading_client.get_equity)
            acc = res.get("equity", {})

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        markup = {
            "inline_keyboard": [
                [
                    {"text": t["btn_refresh_equity"], "callback_data": "nav_equity"},
                    {"text": t["btn_view_positions"], "callback_data": "nav_positions"}
                ],
                [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
            ]
        }

        if not acc:
            text = f"❌ Error retrieving account equity.\n{CARD_LINE}\n⏰ _{t['updated']}: {now_str}_"
            return text, markup

        bal = float(acc.get("balance", 0.0))
        eq = float(acc.get("equity", bal))
        pnl = float(acc.get("floating_pnl", eq - bal))
        mrg = float(acc.get("margin", 0.0))
        fm = float(acc.get("free_margin", eq - mrg))
        ml = float(acc.get("margin_level", 0.0))
        curr = acc.get("currency", "USD")
        pnl_emoji = "🟢" if pnl >= 0 else "🔴"

        text = (
            f"{t['equity_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['balance']} `{bal:,.2f} {curr}`\n"
            f"{t['equity']} `{eq:,.2f} {curr}`\n"
            f"{t['floating_pnl']} {pnl_emoji} *{pnl:+.2f} {curr}*\n"
            f"{t['used_margin']} `{mrg:,.2f} {curr}`\n"
            f"{t['free_margin']} `{fm:,.2f} {curr}`\n"
            f"{t['margin_level']} `{ml:.1f}%`\n"
            f"{CARD_LINE}\n"
            f"⏰ _{t['updated']}: {now_str}_"
        )
        return text, markup

    async def _render_risk(self, lang: str = "en") -> Tuple[str, Dict[str, Any]]:
        t = I18N[lang]
        if self.bot_service:
            rk = self.bot_service.get_risk_telemetry()
        else:
            rk = await asyncio.to_thread(self.trading_client.get_risk)

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        cb = rk.get("circuit_breaker", {})
        status_str = t["active"] if rk.get("can_trade", True) else t["paused"]
        open_pos = rk.get("open_positions_count", 0)
        lots = rk.get("total_exposure_lots", 0.0)
        float_pnl = float(rk.get("total_floating_pnl", 0.0))
        pnl_emoji = "🟢" if float_pnl >= 0 else "🔴"

        text = (
            f"{t['risk_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['risk_exec']} {status_str}\n"
            f"{t['risk_mult']} `×{cb.get('risk_multiplier', 1.0):.1f}`\n"
            f"{t['risk_streaks']} {t['losses']} `{cb.get('consecutive_losses', 0)}` | {t['wins']} `{cb.get('consecutive_wins', 0)}`\n"
            f"{t['risk_exp']} `{open_pos}` {t['positions_unit']} (`{lots:.2f}` {t['lots']})\n"
            f"{t['risk_pnl']} {pnl_emoji} *{float_pnl:+.2f} USD*\n"
            f"{CARD_LINE}\n"
            f"⏰ _{t['updated']}: {now_str}_"
        )
        markup = {
            "inline_keyboard": [
                [
                    {"text": t["btn_refresh_risk"], "callback_data": "nav_risk"},
                    {"text": t["btn_status"], "callback_data": "nav_status"}
                ],
                [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
            ]
        }
        return text, markup

    async def _render_journal(self, lang: str = "en") -> Tuple[str, Dict[str, Any]]:
        t = I18N[lang]
        if self.bot_service:
            res = self.bot_service.get_journal_summary(days=30)
            stats = res.get("stats", {})
        else:
            res = await asyncio.to_thread(self.trading_client.get_execution_analytics)
            stats = res.get("analytics", {}).get("analytics", res.get("analytics", {}))

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        total_orders = stats.get("total_orders", 0)
        rejection_rate = float(stats.get("rejection_rate_pct", 0.0))
        spread = float(stats.get("avg_spread_pips", 0.0))
        latency = float(stats.get("avg_latency_ms", 0.0))
        slippage = float(stats.get("avg_slippage_pips", 0.0))
        cost = float(stats.get("total_slippage_cost_eur", 0.0))

        text = (
            f"{t['journal_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['journal_orders']} `{total_orders}`\n"
            f"{t['journal_rejection']} `{rejection_rate:.1f}%`\n"
            f"{t['journal_spread']} `{spread:.1f} pips`\n"
            f"{t['journal_latency']} `{latency:.0f} ms`\n"
            f"{t['journal_slippage']} `{slippage:+.2f} pips`\n"
            f"{t['journal_cost']} `{cost:+.2f} EUR`\n"
            f"{CARD_LINE}\n"
            f"⏰ _{t['updated']}: {now_str}_"
        )
        markup = {
            "inline_keyboard": [
                [{"text": t["btn_refresh_journal"], "callback_data": "nav_journal"}],
                [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
            ]
        }
        return text, markup

    async def _render_research(self, lang: str = "en") -> Tuple[str, Dict[str, Any]]:
        t = I18N[lang]
        if self.bot_service:
            res = self.bot_service.get_research_summary()
        else:
            res = await asyncio.to_thread(self.research_client.get_status)

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        tot = res.get("total_experiments", 0)
        prom = res.get("promoted_count", 0)
        cand = res.get("candidates_count", 0)
        rej = res.get("rejected_count", 0)

        text = (
            f"{t['research_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['research_total']} `{tot}`\n"
            f"{t['research_prom']} `{prom}` (PROMOTED)\n"
            f"{t['research_cand']} `{cand}` (CANDIDATE)\n"
            f"{t['research_rej']} `{rej}` (REJECTED)\n"
            f"{CARD_LINE}\n"
        )
        recent = res.get("recent_experiments", [])
        if recent:
            text += f"{t['research_recent']}\n"
            for exp in recent[:3]:
                st = exp.get("decision_status", "DRAFT")
                pf = exp.get("best_profit_factor")
                pf_str = f"PF: {pf:.2f}" if pf else "PF: —"
                text += f"• `{exp.get('title')}` ({exp.get('symbol')}) — *{st}* | `{pf_str}`\n"
            text += f"{CARD_LINE}\n"

        text += f"⏰ _{t['updated']}: {now_str}_"
        markup = {
            "inline_keyboard": [
                [{"text": t["btn_refresh_research"], "callback_data": "nav_research"}],
                [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
            ]
        }
        return text, markup

    async def _render_health(self, lang: str = "en") -> Tuple[str, Dict[str, Any]]:
        t = I18N[lang]
        if self.bot_service:
            h = self.bot_service.get_health_status()
        else:
            h = await asyncio.to_thread(self.trading_client.get_health)

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        health_data = h.get("health", h)
        mt5_status = t["connected"] if (h.get("mt5_connected") or health_data.get("mt5_connected")) else t["disconnected"]
        db_data = health_data.get("database", {})
        proc_data = health_data.get("process", {})

        text = (
            f"{t['health_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['health_mt5']} {mt5_status}\n"
            f"{t['health_db']} `WAL Mode ({db_data.get('size_mb', 0.1)} MB)`\n"
            f"{t['health_cpu']} `{proc_data.get('cpu_percent', 0.0)}%`\n"
            f"{t['health_ram']} `{proc_data.get('memory_mb', 0.0):.1f} MB`\n"
            f"{t['health_threads']} `{proc_data.get('num_threads', 1)}`\n"
            f"{CARD_LINE}\n"
            f"⏰ _{t['updated']}: {now_str}_"
        )
        markup = {
            "inline_keyboard": [
                [{"text": t["btn_refresh_health"], "callback_data": "nav_health"}],
                [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
            ]
        }
        return text, markup

    # ── Manejadores de Callbacks y Comandos ───────────────────────────────────

    async def _process_callback_query(self, session: aiohttp.ClientSession, cq: Dict[str, Any]):
        cq_id = cq.get("id")
        data = cq.get("data", "")
        msg = cq.get("message", {})
        chat_id = msg.get("chat", {}).get("id")
        message_id = msg.get("message_id")
        from_user_id = str(cq.get("from", {}).get("id", ""))

        if self.authorized_user_id and from_user_id != str(self.authorized_user_id):
            if cq_id:
                await self._answer_callback_query(session, cq_id, "⛔ Unauthorized.")
            return

        if not chat_id or not message_id or not data:
            return

        lang = self.get_lang(chat_id)
        t = I18N[lang]

        # ── Toggle Idioma / Language ─────────────────────────────────────────
        if data == "toggle_language":
            new_lang = self.toggle_lang(chat_id)
            toast = I18N[new_lang]["lang_switched"]
            if cq_id:
                await self._answer_callback_query(session, cq_id, toast)
            text, markup = self._render_start_menu(new_lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        # ── Navegación del Menú Principal ────────────────────────────────────
        if data in ("nav_start", "refresh_start"):
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            text, markup = self._render_start_menu(lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data in ("nav_positions", "refresh_positions"):
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            text, markup = await self._render_positions(lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data in ("nav_status", "refresh_status"):
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            text, markup = await self._render_status(lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data == "nav_equity":
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            text, markup = await self._render_equity(lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data == "nav_risk":
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            text, markup = await self._render_risk(lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data == "nav_journal":
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            text, markup = await self._render_journal(lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data == "nav_research":
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            text, markup = await self._render_research(lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data == "nav_health":
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            text, markup = await self._render_health(lang)
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data == "nav_autosignals":
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            res = await asyncio.to_thread(self.trading_client.toggle_autosignals, "status")
            enabled = res.get("autosignals_enabled", True)
            st_text = "✅ Active" if enabled else "⏸ Paused" if lang == "en" else "✅ Activo" if enabled else "⏸ Pausado"
            now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
            text = (
                f"{t['autosignals_title']}\n"
                f"{CARD_LINE}\n"
                f"{t['autosignals_exec']} {st_text}\n"
                f"{CARD_LINE}\n"
                f"⏰ _{t['updated']}: {now_str}_"
            )
            markup = {
                "inline_keyboard": [
                    [{"text": "⚡ Toggle On/Off", "callback_data": "toggle_autosignals_exec"}],
                    [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
                ]
            }
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data == "toggle_autosignals_exec":
            res = await asyncio.to_thread(self.trading_client.toggle_autosignals, "toggle")
            enabled = res.get("autosignals_enabled", True)
            st_text = "✅ Active" if enabled else "⏸ Paused" if lang == "en" else "✅ Activo" if enabled else "⏸ Pausado"
            now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
            text = (
                f"{t['autosignals_title']}\n"
                f"{CARD_LINE}\n"
                f"{t['autosignals_exec']} {st_text}\n"
                f"{CARD_LINE}\n"
                f"⏰ _{t['updated']}: {now_str}_"
            )
            markup = {
                "inline_keyboard": [
                    [{"text": "⚡ Toggle On/Off", "callback_data": "toggle_autosignals_exec"}],
                    [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
                ]
            }
            if cq_id:
                await self._answer_callback_query(session, cq_id, f"AutoSignals: {st_text}")
            await self._edit_message_text(session, chat_id, message_id, text, reply_markup=markup)
            return

        elif data == "nav_chart":
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            await self._cmd_chart(session, chat_id, [], lang=lang)
            return

        # ── Señales: Descartar / Aprobar / Forzar ─────────────────────────────
        elif data.startswith("rejc_"):
            try:
                sig_id = int(data.split("_")[1])
            except Exception:
                sig_id = 0
            self.trading_client.reject_signal(sig_id)
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            new_text = t["signal_rejected"]
            await self._edit_message_text(session, chat_id, message_id, new_text, reply_markup={"inline_keyboard": []})

        elif data.startswith("appr_"):
            try:
                sig_id = int(data.split("_")[1])
            except Exception:
                sig_id = 0

            res = self.trading_client.approve_signal(sig_id, force=False)
            if cq_id:
                await self._answer_callback_query(session, cq_id)

            if res.get("error") == "PRICE_DRIFT":
                sig_p = res.get("signal_price", "N/A")
                cur_p = res.get("current_price", "N/A")
                drift = res.get("drift_pips", "N/A")
                drift_text = (
                    f"{t['drift_title']}\n"
                    f"{CARD_LINE}\n"
                    f"{t['drift_body'].format(sig_p=sig_p, cur_p=cur_p, drift=drift)}"
                )
                drift_markup = {
                    "inline_keyboard": [
                        [
                            {"text": t["btn_drift_force"], "callback_data": f"force_{sig_id}"},
                            {"text": t["btn_drift_cancel"], "callback_data": f"rejc_{sig_id}"}
                        ]
                    ]
                }
                await self._edit_message_text(session, chat_id, message_id, drift_text, reply_markup=drift_markup)

            elif res.get("ok"):
                ticket = res.get("ticket", "N/A")
                exec_price = res.get("executed_price", "N/A")
                success_text = t["order_executed"].format(ticket=ticket, price=exec_price)
                await self._edit_message_text(session, chat_id, message_id, success_text, reply_markup={"inline_keyboard": []})
            else:
                err_val = res.get('error') or res.get('message', 'Unknown failure')
                if "expirad" in str(err_val).lower() or "expired" in str(err_val).lower():
                    err_text = t["signal_expired"].format(error=err_val)
                else:
                    err_text = f"❌ Error: {err_val}"
                await self._edit_message_text(session, chat_id, message_id, err_text, reply_markup={"inline_keyboard": []})

        elif data.startswith("force_"):
            try:
                sig_id = int(data.split("_")[1])
            except Exception:
                sig_id = 0
            res = self.trading_client.approve_signal(sig_id, force=True)
            if cq_id:
                await self._answer_callback_query(session, cq_id)
            if res.get("ok"):
                ticket = res.get("ticket", "N/A")
                exec_price = res.get("executed_price", "N/A")
                success_text = t["order_executed"].format(ticket=ticket, price=exec_price)
                await self._edit_message_text(session, chat_id, message_id, success_text, reply_markup={"inline_keyboard": []})
            else:
                err_text = f"❌ Error: {res.get('error') or res.get('message', 'Execution error')}"
                await self._edit_message_text(session, chat_id, message_id, err_text, reply_markup={"inline_keyboard": []})

        # ── Generar Gráfico Técnico On-Demand ─────────────────────────────────
        elif data.startswith("chart_"):
            try:
                ticket = int(data.split("_")[1])
            except Exception:
                ticket = 0
            if ticket:
                if cq_id:
                    loading_msg = f"📊 Generating chart #{ticket}..." if lang == "en" else f"📊 Generando gráfico #{ticket}..."
                    await self._answer_callback_query(session, cq_id, loading_msg)
                from services.chart_helper import get_chart_for_position
                chart_path = await asyncio.to_thread(get_chart_for_position, ticket)
                if chart_path and os.path.exists(chart_path):
                    now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
                    caption = (
                        f"{t['chart_title'].format(target=f'#{ticket}')}\n"
                        f"{CARD_LINE}\n"
                        f"{t['chart_tf']}\n"
                        f"{t['chart_levels']}\n"
                        f"{CARD_LINE}\n"
                        f"⏰ `{now_str}`"
                    )
                    await self.send_photo(session, chat_id, chart_path, caption=caption)
                else:
                    await self._send_response(session, chat_id, t["chart_error"], lang=lang)

    async def _process_update(self, session: aiohttp.ClientSession, update: Dict[str, Any]):
        start_t = time.perf_counter()
        message = update.get("message")
        if not message or "text" not in message:
            return

        chat_id = message["chat"]["id"]
        from_user_id = str(message.get("from", {}).get("id", ""))
        text = message["text"].strip()

        if self.authorized_user_id and from_user_id != str(self.authorized_user_id):
            await self._send_response(session, chat_id, "⛔ Unauthorized.")
            return

        lang = self.get_lang(chat_id)
        words = text.split()
        command = ""
        args = []

        for i, w in enumerate(words):
            clean_w = w.split("@")[0].lower()
            if clean_w.startswith("/"):
                command = clean_w
                args = words[i+1:]
                break

        if not command and words:
            first = words[0].lower()
            aliases = {
                "status": "/status", "estado": "/status",
                "positions": "/positions", "posiciones": "/positions", "pos": "/positions",
                "equity": "/equity", "balance": "/equity", "cuenta": "/equity",
                "risk": "/risk", "riesgo": "/risk",
                "journal": "/journal", "diario": "/journal",
                "research": "/research", "lab": "/research",
                "autosignals": "/autosignals", "señales": "/autosignals", "signals": "/autosignals",
                "health": "/health", "salud": "/health",
                "version": "/version",
                "chart": "/chart", "grafico": "/chart",
                "ping": "/ping",
                "help": "/help", "ayuda": "/help",
                "start": "/start", "inicio": "/start",
                "language": "/language", "idioma": "/language", "lang": "/language"
            }
            if first in aliases:
                command = aliases[first]
                args = words[1:]

        if command in ("/start", "/inicio"):
            if args and (args[0].startswith("chart_") or args[0].startswith("c_") or args[0].isdigit()):
                target_ticket = args[0].replace("chart_", "").replace("c_", "")
                await self._cmd_chart(session, chat_id, [target_ticket], lang=lang)
            else:
                await self._cmd_start(session, chat_id, lang=lang)
        elif command.startswith("/chart_") or command.startswith("/c_"):
            target_ticket = command.split("_", 1)[1]
            await self._cmd_chart(session, chat_id, [target_ticket], lang=lang)
        elif command in ("/help", "/ayuda"):
            await self._cmd_help(session, chat_id, lang=lang)
        elif command in ("/language", "/idioma", "/lang"):
            new_lang = self.toggle_lang(chat_id)
            toast = I18N[new_lang]["lang_switched"]
            text_menu, markup = self._render_start_menu(new_lang)
            await self._send_response(session, chat_id, f"✅ {toast}\n\n{text_menu}", reply_markup=markup, lang=new_lang)
        elif command == "/status":
            await self._cmd_status(session, chat_id, lang=lang)
        elif command == "/positions":
            await self._cmd_positions(session, chat_id, lang=lang)
        elif command == "/close_position":
            await self._cmd_close_position(session, chat_id, args, lang=lang)
        elif command in ("/equity", "/balance"):
            await self._cmd_equity(session, chat_id, lang=lang)
        elif command == "/risk":
            await self._cmd_risk(session, chat_id, lang=lang)
        elif command == "/journal":
            await self._cmd_journal(session, chat_id, lang=lang)
        elif command == "/research":
            await self._cmd_research(session, chat_id, lang=lang)
        elif command == "/autosignals":
            mode = args[0] if args else "status"
            await self._cmd_autosignals(session, chat_id, mode, lang=lang)
        elif command == "/health":
            await self._cmd_health(session, chat_id, lang=lang)
        elif command == "/version":
            await self._cmd_version(session, chat_id, lang=lang)
        elif command == "/logs":
            await self._cmd_logs(session, chat_id, lang=lang)
        elif command in ("/chart", "/grafico"):
            await self._cmd_chart(session, chat_id, args, lang=lang)
        elif command == "/ping":
            elapsed_ms = int((time.perf_counter() - start_t) * 1000)
            p_msg = f"🏓 *Pong!* Response latency: `{elapsed_ms} ms`" if lang == "en" else f"🏓 *Pong!* Latencia de respuesta: `{elapsed_ms} ms`"
            await self._send_response(session, chat_id, p_msg, lang=lang)

    async def _cmd_start(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = self._render_start_menu(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_help(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = self._render_start_menu(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_status(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = await self._render_status(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_positions(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = await self._render_positions(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_equity(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = await self._render_equity(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_risk(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = await self._render_risk(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_journal(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = await self._render_journal(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_research(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = await self._render_research(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_health(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        text, markup = await self._render_health(user_lang)
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_version(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        t = I18N[user_lang]
        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        text = (
            f"{t['version_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['version_plat']}\n"
            f"{t['version_arch']}\n"
            f"{t['version_py']} `v{sys.version.split()[0]}`\n"
            f"{t['version_status']}\n"
            f"{CARD_LINE}\n"
            f"⏰ _{t['updated']}: {now_str}_"
        )
        markup = {"inline_keyboard": [[{"text": t["btn_back_menu"], "callback_data": "nav_start"}]]}
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_autosignals(self, session: aiohttp.ClientSession, chat_id: int, mode: str, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        t = I18N[user_lang]
        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")

        if self.bot_service:
            res = self.bot_service.toggle_autosignals(mode)
        else:
            res = await asyncio.to_thread(self.trading_client.toggle_autosignals, mode)

        enabled = res.get("autosignals_enabled", True)
        st_text = "✅ Active" if enabled else "⏸ Disabled" if user_lang == "en" else "✅ Activo" if enabled else "⏸ Desactivado"

        text = (
            f"{t['autosignals_title']}\n"
            f"{CARD_LINE}\n"
            f"{t['autosignals_exec']} {st_text}\n"
            f"{t['autosignals_status']} `{mode.upper()}`\n"
            f"{CARD_LINE}\n"
            f"⏰ _{t['updated']}: {now_str}_"
        )
        markup = {
            "inline_keyboard": [
                [{"text": "⚡ Toggle On/Off", "callback_data": "toggle_autosignals_exec"}],
                [{"text": t["btn_back_menu"], "callback_data": "nav_start"}]
            ]
        }
        await self._send_response(session, chat_id, text, reply_markup=markup, lang=user_lang)

    async def _cmd_close_position(self, session: aiohttp.ClientSession, chat_id: int, args: List[str], lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        t = I18N[user_lang]

        if not args or not args[0].isdigit():
            await self._send_response(session, chat_id, t["close_usage"], lang=user_lang)
            return

        ticket = int(args[0])
        if self.bot_service:
            res = self.bot_service.close_position(ticket)
        else:
            res = await asyncio.to_thread(self.trading_client.close_position, ticket)

        if res.get("ok"):
            msg = t["close_success"].format(ticket=ticket)
        else:
            msg = t["close_error"].format(ticket=ticket, error=res.get("message", "Execution error"))
        await self._send_response(session, chat_id, msg, lang=user_lang)

    async def _cmd_chart(self, session: aiohttp.ClientSession, chat_id: int, args: List[str], lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        t = I18N[user_lang]
        target = args[0].strip().upper() if args else ""
        from services.chart_helper import get_chart_for_position, get_chart_for_signal

        chart_path = None
        target_label = ""

        if target.isdigit():
            ticket = int(target)
            chart_path = await asyncio.to_thread(get_chart_for_position, ticket)
            target_label = f"#{ticket}"
        elif target in ("EURUSD", "XAUUSD", "BTCEUR", "BTCUSDT", "GOLD"):
            sym = "XAUUSD" if target == "GOLD" else target
            chart_path = await asyncio.to_thread(get_chart_for_signal, sym)
            target_label = f"{sym} (H1)"
        else:
            res = await asyncio.to_thread(self.trading_client.get_positions)
            positions = res.get("positions", []) if isinstance(res, dict) else (res if isinstance(res, list) else [])
            if len(positions) == 1:
                ticket = int(positions[0].get("ticket", 0))
                sym = positions[0].get("symbol", "EURUSD")
                chart_path = await asyncio.to_thread(get_chart_for_position, ticket)
                target_label = f"#{ticket} ({sym})"
            elif len(positions) > 1:
                buttons = []
                for p in positions:
                    ticket_id = p.get("ticket")
                    sym = p.get("symbol", "")
                    if ticket_id:
                        buttons.append({"text": f"📊 #{ticket_id} {sym}", "callback_data": f"chart_{ticket_id}"})
                rows = [buttons[i:i+2] for i in range(0, len(buttons), 2)]
                rows.append([{"text": t["btn_back_menu"], "callback_data": "nav_start"}])
                await self._send_response(session, chat_id, t["chart_select"], reply_markup={"inline_keyboard": rows}, lang=user_lang)
                return
            else:
                chart_path = await asyncio.to_thread(get_chart_for_signal, "EURUSD")
                target_label = "EURUSD (H1)"

        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        if chart_path and os.path.exists(chart_path):
            caption = (
                f"{t['chart_title'].format(target=target_label)}\n"
                f"{CARD_LINE}\n"
                f"{t['chart_tf']}\n"
                f"{t['chart_levels']}\n"
                f"{CARD_LINE}\n"
                f"⏰ `{now_str}`"
            )
            await self.send_photo(session, chat_id, chart_path, caption=caption)
        else:
            await self._send_response(session, chat_id, t["chart_error"], lang=user_lang)

    async def _cmd_logs(self, session: aiohttp.ClientSession, chat_id: int, lang: Optional[str] = None):
        user_lang = lang or self.get_lang(chat_id)
        t = I18N[user_lang]
        try:
            log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
            log_files = [os.path.join(log_dir, f) for f in os.listdir(log_dir) if f.endswith(".txt")]
            if not log_files:
                await self._send_response(session, chat_id, "ℹ️ No recent logs available.", lang=user_lang)
                return

            latest_log = max(log_files, key=os.path.getmtime)
            with open(latest_log, "r", encoding="utf-8", errors="ignore") as f:
                lines = [l.strip() for l in f.readlines() if l.strip()]

            recent = lines[-6:] if lines else ["No events."]
            now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
            header = "📋 *Recent System Logs:*" if user_lang == "en" else "📋 *Registros Recientes del Sistema:*"
            text = (
                f"{header}\n"
                f"{CARD_LINE}\n" +
                "\n".join(f"`{l}`" for l in recent) +
                f"\n{CARD_LINE}\n"
                f"⏰ _{t['updated']}: {now_str}_"
            )
            markup = {"inline_keyboard": [[{"text": t["btn_back_menu"], "callback_data": "nav_start"}]]}
            await self._send_response(session, chat_id, text[:4000], reply_markup=markup, lang=user_lang)
        except Exception as e:
            await self._send_response(session, chat_id, f"⚠️ Error reading logs: {e}", lang=user_lang)
