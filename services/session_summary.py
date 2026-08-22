"""
session_summary.py — Resumen automático de sesiones de trading

Detecta el cierre de cada sesión de mercado (London, New York, Asian) y genera
un resumen estadístico de las señales generadas durante esa sesión, incluyendo:
  - Total de señales por símbolo
  - Estado del circuit breaker al cierre
  - Señales activas al cierre de sesión

Uso desde bot.py:
    from session_summary import session_summary
    # session_summary es la instancia global, lista para usar

El bot crea un task en on_ready() que llama a session_summary.start()
para registrar automáticamente el loop asíncrono.
"""

import asyncio
import logging
from datetime import datetime, timezone, date, timedelta
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── Definición de sesiones ────────────────────────────────────────────────────

SESSIONS: Dict[str, Dict] = {
    "ASIAN": {
        "name": "Sesión Asiática 🌏",
        "open_utc": 0,    # 00:00 UTC
        "close_utc": 9,   # 09:00 UTC
        "pairs": [],      # No tenemos pares asiáticos activos
        "emoji": "🌏",
    },
    "LONDON": {
        "name": "Sesión Londres 🇬🇧",
        "open_utc": 8,    # 08:00 UTC
        "close_utc": 17,  # 17:00 UTC
        "pairs": ["EURUSD", "XAUUSD"],
        "emoji": "🇬🇧",
    },
    "NEWYORK": {
        "name": "Sesión Nueva York 🗽",
        "open_utc": 13,   # 13:00 UTC
        "close_utc": 22,  # 22:00 UTC
        "pairs": ["EURUSD", "XAUUSD"],
        "emoji": "🗽",
    },
}


class SessionSummarySystem:
    """
    Monitoriza el cierre de sesiones de trading y envía resúmenes
    estadísticos al canal de Discord.
    """

    def __init__(self):
        # {session_name: date_string} — evitar enviar el mismo resumen dos veces
        self._sent_today: Dict[str, str] = {}

    # ── API pública ───────────────────────────────────────────────────────────

    def should_send_summary(self, session_name: str) -> Tuple[bool, str]:
        """
        Retorna (True, session_key) si hay que enviar el resumen ahora
        (dentro de ±10 min del cierre), o (False, '') si no.
        """
        now = datetime.now(timezone.utc)
        session = SESSIONS.get(session_name)
        if session is None:
            return False, ""

        close_hour = session["close_utc"]
        # Ventana de envío: [close_hour:00, close_hour:10)
        if now.hour != close_hour or now.minute >= 10:
            return False, ""

        today_str = now.date().isoformat()
        key = f"{session_name}_{today_str}"

        if key in self._sent_today:
            return False, ""  # ya enviado hoy

        return True, key

    def mark_sent(self, key: str) -> None:
        """Marca una clave como ya enviada."""
        self._sent_today[key] = datetime.now(timezone.utc).isoformat()
        # Limpieza: mantener solo las de hoy (máx 20 entradas)
        if len(self._sent_today) > 20:
            oldest_key = next(iter(self._sent_today))
            del self._sent_today[oldest_key]

    def build_summary_message(
        self,
        session_name: str,
        signal_history: List[Dict],
        circuit_breaker_status: Optional[Dict] = None,
    ) -> str:
        """
        Genera el texto del resumen de sesión.

        Args:
            session_name: Nombre de la sesión (LONDON, NEWYORK, ASIAN)
            signal_history: Lista de señales del período (últimas horas)
            circuit_breaker_status: Dict devuelto por CircuitBreaker.get_status()

        Returns:
            Texto formateado para Discord (≤ 2000 chars)
        """
        session = SESSIONS.get(session_name, {})
        emoji = session.get("emoji", "📊")
        name = session.get("name", session_name)
        pairs = session.get("pairs", [])
        now = datetime.now(timezone.utc)

        # ── Filtrar señales de esta sesión ────────────────────────────────────
        open_h = session.get("open_utc", 0)
        close_h = session.get("close_utc", 24)

        session_signals = [
            s for s in signal_history
            if self._is_in_session(s, open_h, close_h, now)
        ]

        total = len(session_signals)
        wins = sum(1 for s in session_signals if s.get("final_status") == "win")
        losses = sum(1 for s in session_signals if s.get("final_status") == "loss")
        closed = wins + losses
        pending = total - closed
        winrate = (wins / closed * 100) if closed > 0 else 0.0

        # ── Stats por par ─────────────────────────────────────────────────────
        pair_lines: List[str] = []
        for pair in pairs:
            pair_sigs = [s for s in session_signals if s.get("symbol") == pair]
            if not pair_sigs:
                continue
            pw = sum(1 for s in pair_sigs if s.get("final_status") == "win")
            pl = sum(1 for s in pair_sigs if s.get("final_status") == "loss")
            pc = pw + pl
            pwr = (pw / pc * 100) if pc > 0 else 0.0
            icon = "✅" if pwr >= 50 else ("⚠️" if pc > 0 else "—")
            pair_lines.append(
                f"  {icon} **{pair}** → {len(pair_sigs)} señales"
                + (f" | {pw}W/{pl}L ({pwr:.0f}%)" if pc > 0 else "")
            )

        # ── Circuit Breaker ───────────────────────────────────────────────────
        cb_line = ""
        if circuit_breaker_status:
            can_trade = circuit_breaker_status.get("can_trade", True)
            multiplier = circuit_breaker_status.get("risk_multiplier", 1.0)
            cons_losses = circuit_breaker_status.get("consecutive_losses", 0)
            cons_wins = circuit_breaker_status.get("consecutive_wins", 0)

            if not can_trade:
                reason = circuit_breaker_status.get("reason", "")
                cb_line = f"\n🔴 **Circuit Breaker ACTIVO** — {reason}"
            elif cons_losses >= 2:
                cb_line = f"\n⚠️ Circuit Breaker: {cons_losses} pérdidas seguidas | riesgo ×{multiplier:.1f}"
            elif cons_wins >= 3:
                cb_line = f"\n🟢 Circuit Breaker: racha de {cons_wins} wins | riesgo ×{multiplier:.1f}"
            else:
                cb_line = f"\n✅ Circuit Breaker: OK | riesgo ×{multiplier:.1f}"

        # ── Formatear ─────────────────────────────────────────────────────────
        lines = [
            f"{emoji} **Resumen — {name}**",
            f"🕐 Cierre: {now.strftime('%H:%M')} UTC | {now.strftime('%d/%m/%Y')}",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "",
        ]

        if total == 0:
            lines.append("📊 Sin señales en esta sesión.")
        else:
            lines += [
                f"📈 **Señales generadas:** {total}",
                f"✅ Cerradas: {closed} ({wins}W / {losses}L)"
                + (f" — WR {winrate:.1f}%" if closed > 0 else ""),
                f"⏳ Pendientes: {pending}",
                "",
            ]
            if pair_lines:
                lines.append("**Por par:**")
                lines.extend(pair_lines)

        lines.append(cb_line)
        lines += [
            "",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"_Próxima sesión activa en {self._next_session_name(session_name)}_",
        ]

        msg = "\n".join(lines)
        # Truncar si supera el límite de Discord
        if len(msg) > 1950:
            msg = msg[:1950] + "\n…*(truncado)*"
        return msg

    # ── Helpers internos ──────────────────────────────────────────────────────

    @staticmethod
    def _is_in_session(signal: Dict, open_h: int, close_h: int,
                       reference: datetime) -> bool:
        """Devuelve True si la señal fue generada durante la sesión de hoy."""
        try:
            ts_raw = signal.get("timestamp") or signal.get("time")
            if ts_raw is None:
                return False
            if isinstance(ts_raw, str):
                ts = datetime.fromisoformat(ts_raw)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
            else:
                ts = ts_raw
            # Mismo día UTC y dentro del rango horario
            if ts.date() != reference.date():
                return False
            return open_h <= ts.hour < close_h
        except Exception:
            return False

    @staticmethod
    def _next_session_name(current: str) -> str:
        order = ["ASIAN", "LONDON", "NEWYORK"]
        idx = order.index(current) if current in order else -1
        next_idx = (idx + 1) % len(order)
        return SESSIONS[order[next_idx]]["name"]


# ── Instancia global ──────────────────────────────────────────────────────────

session_summary = SessionSummarySystem()
