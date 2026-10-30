"""
Servicio de Comandos Discord — Refactored (Adaptador Desacoplado para LastEdge App)
===================================================================================
Adaptador de comandos Discord (Slash Commands y Prefijo '!' / '/') completamente desacoplado.
Consume exclusivamente `TradingClient` y `ResearchClient` a través de APIs REST.
Cero dependencias internas de `Trading Engine` o `Strategy Lab`.

Comandos Disponibles (vía /comando o !comando):
  /help           - Muestra la lista de comandos disponibles e instrucciones
  /status         - Estado unificado del bot, uptime, MT5, Circuit Breaker y noticias
  /positions      - Posiciones abiertas en MT5 con P&L flotante en vivo
  /signals        - Historial de señales de trading recientes y estado de ejecución
  /close_position - Cierra una posición con confirmación interactiva (/close_position <ticket>)
  /equity         - Balance, equity, margen y nivel de margen
  /risk           - Telemetría de Risk Engine v2, salvaguardas de broker y Circuit Breaker
  /journal        - Métricas de calidad de ejecución (30 días)
  /research       - Ficha de la Research Database e investigaciones
  /autosignals    - Estado y control de auto-ejecución (on/off/status)
  /health         - Diagnóstico técnico de la plataforma (MT5, Control App, Trading Engine)
  /version        - Información de despliegue y versión
  /ping           - Comprobación de latencia de Discord
  /logs           - Últimos eventos y logs registrados
  /discord        - Metadata técnica de Discord (Application ID, Guild, Invitación)
"""

from __future__ import annotations

import os
import sys
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple, Set
import discord
from discord.ext import commands

from services.clients.trading_client import get_trading_client, TradingClient
from services.clients.research_client import get_research_client, ResearchClient

logger = logging.getLogger(__name__)


# ── Interactive Discord UI Views ───────────────────────────────────────────────

class ClosePositionConfirmView(discord.ui.View):
    """Vista interactiva con botones para confirmar o cancelar el cierre forzado de una orden MT5."""

    def __init__(self, ticket: int, authorized_user_ids: Set[int], trading_client: TradingClient, timeout: float = 60.0):
        super().__init__(timeout=timeout)
        self.ticket = ticket
        self.authorized_user_ids = authorized_user_ids
        self.trading_client = trading_client

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if not self.authorized_user_ids or interaction.user.id not in self.authorized_user_ids:
            await interaction.response.send_message("⛔ Acceso denegado: No tienes permisos para operar.", ephemeral=True)
            return False
        return True

    @discord.ui.button(label="Confirmar Cierre", style=discord.ButtonStyle.danger, emoji="⚠️")
    async def confirm_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        for child in self.children:
            child.disabled = True
        res = await asyncio.to_thread(self.trading_client.close_position, self.ticket)
        if res.get("ok"):
            msg = f"✅ Posición **#{self.ticket}** cerrada exitosamente en MT5 por @{interaction.user.display_name}."
        else:
            msg = f"❌ Error al cerrar posición #{self.ticket}: {res.get('message', 'Fallo en broker MT5')}"
        if interaction.message:
            await interaction.message.edit(content=msg, view=self)
        else:
            await interaction.followup.send(msg)

    @discord.ui.button(label="Cancelar", style=discord.ButtonStyle.secondary, emoji="✖️")
    async def cancel_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        for child in self.children:
            child.disabled = True
        if interaction.message:
            await interaction.message.edit(content=f"Operación cancelada. La posición **#{self.ticket}** sigue abierta.", view=self)
        await interaction.response.send_message("Cierre cancelado.", ephemeral=True)


class CommandsService:
    """Adaptador de Comandos Discord desacoplado consumiendo APIs REST."""

    def __init__(
        self,
        bot: commands.Bot,
        state=None,
        config: Optional[dict] = None,
        trading_client: Optional[TradingClient] = None,
        research_client: Optional[ResearchClient] = None
    ):
        self.bot = bot
        self.state = state
        self.config = config or {}

        # Parse authorized user IDs (Fail-Safe: default to empty set -> deny all until configured)
        raw_auth = self.config.get("AUTHORIZED_USER_IDS")
        if isinstance(raw_auth, set):
            self.authorized_user_ids: Set[int] = raw_auth
        elif isinstance(raw_auth, (list, tuple)):
            self.authorized_user_ids = {int(x) for x in raw_auth if str(x).isdigit() and int(x) != 0}
        else:
            single = self.config.get("AUTHORIZED_USER_ID", 0)
            self.authorized_user_ids = {int(single)} if single and int(single) != 0 else set()

        self.AUTHORIZED_USER_ID = next(iter(self.authorized_user_ids)) if self.authorized_user_ids else 0
        self.trading_client = trading_client or get_trading_client()
        self.research_client = research_client or get_research_client()

    def _is_authorized(self, user_id: int) -> bool:
        """Verifica si el usuario está autorizado para operar el bot (Fail-safe: denegado si no hay IDs)."""
        if not self.authorized_user_ids:
            logger.warning(f"[Discord Auth] Bloqueado intento de comando: no hay usuarios autorizados configurados (User ID: {user_id})")
            return False
        return int(user_id) in self.authorized_user_ids

    def _get_account_currency(self) -> str:
        """Obtiene la divisa de la cuenta de trading (USD, EUR, etc.) desde MT5."""
        try:
            eq = self.trading_client.get_equity()
            if eq and eq.get("ok"):
                return eq.get("equity", {}).get("currency", "USD")
        except Exception:
            pass
        return "USD"

    def setup_commands(self):
        """Registra Slash Commands y Comandos de Texto tradicional (!comando)."""
        self._setup_slash_commands()
        self._setup_prefix_commands()

    # ── Embed Builders ─────────────────────────────────────────────────────────

    def _build_status_embed(self, st: Dict[str, Any]) -> discord.Embed:
        mt5_st = "🟢 Conectado" if st.get("mt5_connected") else "🔴 Desconectado"
        cb = st.get("circuit_breaker", {})
        cb_st = "🟢 Activo" if cb.get("can_trade", True) else "🔴 Pausado"

        embed = discord.Embed(
            title="⚡ LastEdge — Estado General del Sistema",
            color=0x3b82f6 if st.get("mt5_connected") else 0xef4444,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Estado Bot", value=f"`{st.get('status', 'ONLINE')}`", inline=True)
        embed.add_field(name="Uptime", value=f"`{st.get('uptime', '0h 0m')}`", inline=True)
        embed.add_field(name="MT5 Broker", value=mt5_st, inline=True)
        embed.add_field(name="Cuenta MT5", value=f"`{st.get('account_number') or '—'}`", inline=True)
        embed.add_field(name="Circuit Breaker", value=f"{cb_st} (×{cb.get('risk_multiplier', 1.0):.1f})", inline=True)
        embed.add_field(name="Autosignals", value="✅ Activo" if st.get("autosignals_enabled") else "⏸ Desactivado", inline=True)

        pairs = st.get("monitored_symbols", [])
        pairs_str = ", ".join(pairs) if pairs else "EURUSD, XAUUSD, BTCEUR"
        embed.add_field(name="Pares Monitoreados", value=f"`{pairs_str}`", inline=False)
        embed.add_field(name="Filtro de Noticias", value=st.get("news_indicator", "🟢 Sin noticias de alto impacto"), inline=False)
        embed.set_footer(text=f"Servidor: {st.get('server') or 'FXLiveCapital-Server'}")
        return embed

    def _build_positions_embed(self, pos_data: Dict[str, Any], currency: Optional[str] = None) -> Tuple[Optional[discord.Embed], Optional[str]]:
        positions = pos_data.get("positions", [])
        if not positions:
            return None, "ℹ️ No hay posiciones abiertas actualmente en MT5."

        curr = currency or self._get_account_currency()
        total_pnl = sum(p.get("profit", 0.0) for p in positions)
        total_pnl_emoji = "🟢" if total_pnl >= 0 else "🔴"

        embed = discord.Embed(
            title=f"📊 Posiciones Abiertas en MT5 ({len(positions)})",
            description=f"**P&L Total Flotante:** {total_pnl_emoji} **{total_pnl:+.2f} {curr}**",
            color=0x10b981 if total_pnl >= 0 else 0xef4444,
            timestamp=datetime.now(timezone.utc)
        )
        for p in positions:
            profit = p.get("profit", 0.0)
            pnl_emoji = "🟢" if profit >= 0 else "🔴"
            val_str = (
                f"Lotes: `{p.get('volume', 0.0):.2f}` | Entrada: `{p.get('open_price', 0.0):.5f}` | Actual: `{p.get('current_price', 0.0):.5f}`\n"
                f"P&L: {pnl_emoji} **{profit:+.2f} {curr}** | SL: `{p.get('sl') or '—'}` | TP: `{p.get('tp') or '—'}`"
            )
            embed.add_field(name=f"#{p.get('ticket')} — {p.get('symbol')} ({p.get('type')})", value=val_str, inline=False)
        return embed, None

    def _build_equity_embed(self, res: Dict[str, Any]) -> Tuple[Optional[discord.Embed], Optional[str]]:
        acc = res.get("equity", {})
        if not res.get("ok") and not acc:
            return None, f"❌ Error: {res.get('message', 'Servicio offline')}"

        pnl = acc.get("floating_pnl", 0.0)
        pnl_emoji = "🟢" if pnl >= 0 else "🔴"
        curr = acc.get("currency", "USD")

        embed = discord.Embed(
            title="💰 Balance & Equity — MT5 Account",
            color=0x3b82f6,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Balance Base", value=f"**{acc.get('balance', 0.0):,.2f} {curr}**", inline=True)
        embed.add_field(name="Equity Actual", value=f"**{acc.get('equity', 0.0):,.2f} {curr}**", inline=True)
        embed.add_field(name="P&L Flotante", value=f"{pnl_emoji} **{pnl:+.2f} {curr}**", inline=True)
        embed.add_field(name="Margen Usado", value=f"`{acc.get('margin', 0.0):,.2f} {curr}`", inline=True)
        embed.add_field(name="Margen Libre", value=f"`{acc.get('free_margin', 0.0):,.2f} {curr}`", inline=True)
        embed.add_field(name="Nivel de Margen", value=f"`{acc.get('margin_level', 0.0):.1f}%`", inline=True)
        embed.set_footer(text=f"Cuenta: {acc.get('account', 'N/A')} | Apalancamiento: 1:{acc.get('leverage', 'N/A')}")
        return embed, None

    def _build_risk_embed(self, res: Dict[str, Any], currency: Optional[str] = None) -> discord.Embed:
        curr = currency or self._get_account_currency()
        cb = res.get("circuit_breaker", {})
        can_trade = res.get("can_trade", cb.get("can_trade", True))
        status_str = "🟢 OPERATIVO" if can_trade else "🔴 PAUSADO (Circuit Breaker)"

        embed = discord.Embed(
            title="🛡️ Risk Engine v2 — Telemetría de Riesgo",
            color=0x10b981 if can_trade else 0xef4444,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Estado de Trading", value=f"**{status_str}**", inline=False)
        embed.add_field(name="Multiplicador de Riesgo", value=f"`×{cb.get('risk_multiplier', 1.0):.1f}`", inline=True)
        embed.add_field(name="Rachas", value=f"Pérdidas: `{cb.get('consecutive_losses', 0)}` | Ganadas: `{cb.get('consecutive_wins', 0)}`", inline=True)

        port_risk = res.get("portfolio_risk_pct", 0.0)
        max_risk = res.get("max_portfolio_risk_pct", 3.0)
        rem_cap = res.get("remaining_capacity_pct", max(0.0, max_risk - port_risk))
        embed.add_field(name="Riesgo de Cartera", value=f"`{port_risk:.2f}%` / `{max_risk:.1f}%` (Libre: `{rem_cap:.2f}%`)", inline=True)

        open_cnt = res.get("open_positions_count", 0)
        exp_lots = res.get("total_exposure_lots", 0.0)
        embed.add_field(name="Posiciones / Exposición", value=f"`{open_cnt}` abiertas (`{exp_lots:.2f}` lotes)", inline=True)

        tot_pnl = res.get("total_floating_pnl", 0.0)
        pnl_emoji = "🟢" if tot_pnl >= 0 else "🔴"
        embed.add_field(name="P&L Flotante Total", value=f"{pnl_emoji} **{tot_pnl:+.2f} {curr}**", inline=True)

        margin_lvl = res.get("margin_level", res.get("margin_level_pct", 0.0))
        embed.add_field(name="Nivel de Margen", value=f"`{margin_lvl:.1f}%`", inline=True)
        embed.add_field(name="Broker Safeguards", value="`Max Margen/Símbolo: 10%` | `Max Spread: 3.5 p`", inline=False)
        embed.set_footer(text="LastEdge Risk Engine v2 — FXLiveCapital Server")
        return embed

    def _build_signals_embed(self, res: Dict[str, Any]) -> discord.Embed:
        signals = res.get("signals", [])
        if not signals:
            return discord.Embed(
                title="📡 Señales de Trading — Historial",
                description="ℹ️ No hay señales registradas recientemente.",
                color=0x3b82f6,
                timestamp=datetime.now(timezone.utc)
            )

        embed = discord.Embed(
            title=f"📡 Últimas Señales de Trading ({min(len(signals), 5)} mostradas)",
            color=0x3b82f6,
            timestamp=datetime.now(timezone.utc)
        )
        for s in signals[:5]:
            status = str(s.get("status", "unknown")).lower()
            if status == "open":
                st_icon = "🟡 PENDIENTE"
            elif status == "executed":
                st_icon = "🟢 EJECUTADA"
            elif status == "expired":
                st_icon = "⚪ EXPIRADA"
            else:
                st_icon = f"🔴 {status.upper()}"

            side = s.get("type", "BUY").upper()
            side_icon = "🟢" if side == "BUY" else "🔴"
            sym = s.get("symbol", "N/A")
            sig_id = s.get("id", "—")
            entry = s.get("entry", 0.0)
            sl = s.get("stopLoss", 0.0)
            tp = s.get("takeProfit", 0.0)
            rr = s.get("rrRatio", 0.0)
            strat = s.get("strategy", "N/A")
            ts = s.get("timestamp", "")

            val = (
                f"**Estado:** {st_icon} | **Entrada:** `{entry}`\n"
                f"**SL:** `{sl}` | **TP:** `{tp}` | **R:R:** `1:{rr:.2f}`\n"
                f"**Estrategia:** `{strat}` | `{ts}`"
            )
            embed.add_field(name=f"#{sig_id} — {side_icon} {side} {sym}", value=val, inline=False)
        embed.set_footer(text="Usa /positions para consultar operaciones vivas.")
        return embed

    def _build_journal_embed(self, res: Dict[str, Any], days: int) -> discord.Embed:
        stats = res.get("analytics", {})
        tot = stats.get("total_orders", 0)

        embed = discord.Embed(
            title=f"📖 Diario de Ejecución ({days} Días)",
            color=0x8b5cf6,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Total Órdenes", value=f"`{tot}`", inline=True)
        embed.add_field(name="Tasa de Rechazo", value=f"`{stats.get('rejection_rate_pct', 0.0):.1f}%`", inline=True)
        embed.add_field(name="Spread Medio", value=f"`{stats.get('avg_spread_pips', 0.0):.1f} pips`", inline=True)
        embed.add_field(name="Latencia Media", value=f"`{stats.get('avg_latency_ms', 0.0):.0f} ms`", inline=True)
        embed.add_field(name="Slippage Medio", value=f"`{stats.get('avg_slippage_pips', 0.0):+.2f} pips`", inline=True)
        return embed

    def _build_research_embed(self, res: Dict[str, Any]) -> discord.Embed:
        embed = discord.Embed(
            title="🔬 Research Database — Resumen",
            color=0x06b6d4,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Total Experimentos", value=f"`{res.get('total_experiments', 0)}`", inline=True)
        embed.add_field(name="Promocionados", value=f"`{res.get('promoted_count', 0)}` (PROMOTED)", inline=True)
        embed.add_field(name="Candidatos", value=f"`{res.get('candidates_count', 0)}` (CANDIDATE)", inline=True)
        return embed

    def _build_autosignals_embed(self, res: Dict[str, Any]) -> discord.Embed:
        enabled = res.get("enabled", False)
        status_text = "🟢 ACTIVADA" if enabled else "🔴 DESACTIVADA"
        color = 0x10b981 if enabled else 0xef4444

        embed = discord.Embed(
            title="⚡ Auto-Ejecución de Señales (Autosignals)",
            description=f"El sistema de ejecución automática de señales está **{status_text}**.",
            color=color,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Confianza Mínima", value=f"`{res.get('min_confidence', 'HIGH')}`", inline=True)
        embed.add_field(name="Riesgo / Trade", value=f"`{res.get('risk_pct', 0.5):.2f}%`", inline=True)
        embed.add_field(name="Modo Trailing Stop", value=f"`{res.get('trailing_stop_mode', 'atr').upper()}`", inline=True)
        embed.set_footer(text="Usa /autosignals on o /autosignals off para modificar.")
        return embed

    def _build_health_embed(self, t_online: bool, r_online: bool) -> discord.Embed:
        all_ok = t_online and r_online
        embed = discord.Embed(
            title="🩺 LastEdge — Diagnóstico de Salud Técnica",
            color=0x10b981 if all_ok else 0xf59e0b,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Trading Engine (:8081)", value="🟢 ONLINE" if t_online else "🔴 OFFLINE", inline=True)
        embed.add_field(name="Strategy Lab (:8082)", value="🟢 ONLINE" if r_online else "🔴 OFFLINE", inline=True)
        embed.add_field(name="Control App (:8080)", value="🟢 ONLINE", inline=True)
        return embed

    def _build_version_embed(self) -> discord.Embed:
        embed = discord.Embed(
            title="📦 LastEdge — Información de Despliegue",
            color=0x6366f1,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Plataforma", value="**LastEdge Trading Ecosystem**", inline=False)
        embed.add_field(name="Versión", value="`v1.0.0 (Decoupled REST)`", inline=True)
        embed.add_field(name="Python", value=f"`v{sys.version.split()[0]}`", inline=True)
        embed.add_field(name="Arquitectura", value="`Clean Architecture + Risk v2`", inline=True)
        return embed

    def _build_help_embed(self) -> discord.Embed:
        embed = discord.Embed(
            title="🤖 LastEdge Discord Bot — Comandos Disponibles",
            description="Puedes utilizar comandos tanto con barra slash (`/status`) como con prefijo tradicional (`!status`).",
            color=0x3b82f6
        )
        embed.add_field(name="📊 Operativa", value="`/status`, `/positions`, `/signals`, `/equity`, `/risk`, `/close_position <ticket>`", inline=False)
        embed.add_field(name="⚙️ Control y Señales", value="`/autosignals [on|off|status]`, `/journal [días]`, `/research`", inline=False)
        embed.add_field(name="🩺 Diagnóstico y Red", value="`/health`, `/version`, `/ping`, `/logs`, `/discord`", inline=False)
        auth_preview = f"`{next(iter(self.authorized_user_ids))}`" if self.authorized_user_ids else "Ninguno"
        embed.set_footer(text=f"LastEdge Quantitative Trading Platform • Usuario Autorizado: {auth_preview}")
        return embed

    # ── 1. Slash Commands Registration ────────────────────────────────────────

    def _setup_slash_commands(self):
        bot = self.bot

        @bot.tree.command(name="help", description="Muestra el menú de ayuda con todos los comandos disponibles.")
        async def slash_help(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=False)
            embed = self._build_help_embed()
            await interaction.followup.send(embed=embed)

        @bot.tree.command(name="status", description="Estado unificado del bot, uptime, MT5, Circuit Breaker y noticias.")
        async def slash_status(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                st = await asyncio.to_thread(self.trading_client.get_status)
                embed = self._build_status_embed(st)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en status: {e}")
                await interaction.followup.send(f"⚠️ Error obteniendo estado: {e}")

        @bot.tree.command(name="positions", description="Posiciones abiertas en tiempo real en MetaTrader 5.")
        async def slash_positions(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                pos_data = await asyncio.to_thread(self.trading_client.get_positions)
                curr = await asyncio.to_thread(self._get_account_currency)
                embed, err_msg = self._build_positions_embed(pos_data, currency=curr)
                if embed:
                    await interaction.followup.send(embed=embed)
                else:
                    await interaction.followup.send(err_msg or "ℹ️ Sin posiciones abiertas.")
            except Exception as e:
                logger.error(f"[Discord Slash] Error en positions: {e}")
                await interaction.followup.send(f"⚠️ Error obteniendo posiciones: {e}")

        @bot.tree.command(name="signals", description="Consulta las últimas señales de trading generadas y su estado.")
        async def slash_signals(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.trading_client.get_signals)
                embed = self._build_signals_embed(res)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en signals: {e}")
                await interaction.followup.send(f"⚠️ Error al consultar señales: {e}")

        @bot.tree.command(name="close_position", description="Cierra una posición abierta especificando su número de Ticket.")
        @discord.app_commands.describe(ticket="Número de ticket de la posición a cerrar")
        async def slash_close_position(interaction: discord.Interaction, ticket: int):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                view = ClosePositionConfirmView(ticket, self.authorized_user_ids, self.trading_client)
                await interaction.followup.send(
                    f"⚠️ **Confirmación de Seguridad**\n¿Estás seguro de que deseas forzar el cierre de la posición **#{ticket}** en MT5?",
                    view=view
                )
            except Exception as e:
                logger.error(f"[Discord Slash] Error en close_position: {e}")
                await interaction.followup.send(f"⚠️ Error al preparar cierre de posición: {e}")

        @bot.tree.command(name="equity", description="Balance, equity, margen y métricas de la cuenta MT5.")
        async def slash_equity(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.trading_client.get_equity)
                embed, err_msg = self._build_equity_embed(res)
                if embed:
                    await interaction.followup.send(embed=embed)
                else:
                    await interaction.followup.send(err_msg or "❌ Error obteniendo datos de cuenta.")
            except Exception as e:
                logger.error(f"[Discord Slash] Error en equity: {e}")
                await interaction.followup.send(f"⚠️ Error al consultar equity: {e}")

        @bot.tree.command(name="risk", description="Telemetría de Risk Engine v2, salvaguardas y estado del Circuit Breaker.")
        async def slash_risk(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.trading_client.get_risk)
                curr = await asyncio.to_thread(self._get_account_currency)
                embed = self._build_risk_embed(res, currency=curr)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en risk: {e}")
                await interaction.followup.send(f"⚠️ Error al consultar telemetría de riesgo: {e}")

        @bot.tree.command(name="journal", description="Métricas de Calidad de Ejecución y Diario de Trading.")
        @discord.app_commands.describe(days="Días de historial a evaluar (por defecto: 30)")
        async def slash_journal(interaction: discord.Interaction, days: int = 30):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.trading_client.get_execution_analytics)
                embed = self._build_journal_embed(res, days)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en journal: {e}")
                await interaction.followup.send(f"⚠️ Error al consultar diario: {e}")

        @bot.tree.command(name="research", description="Resumen de la Research Database y experimentos.")
        async def slash_research(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.research_client.get_status)
                embed = self._build_research_embed(res)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en research: {e}")
                await interaction.followup.send(f"⚠️ Error al consultar research: {e}")

        @bot.tree.command(name="autosignals", description="Consulta o cambia el estado de auto-ejecución de señales.")
        @discord.app_commands.describe(action="Acción: status, on, off")
        async def slash_autosignals(interaction: discord.Interaction, action: str = "status"):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                act = action.strip().lower()
                res = await asyncio.to_thread(self.trading_client.toggle_autosignals, act)
                embed = self._build_autosignals_embed(res)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en autosignals: {e}")
                await interaction.followup.send(f"⚠️ Error al actualizar autosignals: {e}")

        @bot.tree.command(name="health", description="Diagnóstico técnico de salud e infraestructura de la plataforma.")
        async def slash_health(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                t_online = await asyncio.to_thread(self.trading_client.is_online)
                r_online = await asyncio.to_thread(self.research_client.is_online)
                embed = self._build_health_embed(t_online, r_online)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en health: {e}")
                await interaction.followup.send(f"⚠️ Error al diagnosticar salud: {e}")

        @bot.tree.command(name="version", description="Información de la versión desplegada y build.")
        async def slash_version(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            embed = self._build_version_embed()
            await interaction.response.send_message(embed=embed)

        @bot.tree.command(name="ping", description="Comprueba la latencia del bot en Discord.")
        async def slash_ping(interaction: discord.Interaction):
            latency_ms = round(self.bot.latency * 1000) if self.bot.latency else 0
            await interaction.response.send_message(f"🏓 Pong! Latencia de Discord Gateway: `{latency_ms} ms`")

        @bot.tree.command(name="logs", description="Muestra los últimos eventos o advertencias del log.")
        async def slash_logs(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=False)
            await interaction.followup.send("📋 Los logs del sistema se encuentran activos en `LastEdge App/logs/`.")

        @bot.tree.command(name="discord", description="Metadata técnica de registro y sincronización del bot en Discord.")
        async def slash_discord(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ Acceso denegado: Usuario no autorizado.", ephemeral=True)
                return
            await interaction.response.defer(thinking=False)
            app_id = self.bot.application_id or (self.bot.user.id if self.bot.user else "—")
            guild_id = self.config.get("GUILD_ID", "Global")
            invite_url = f"https://discord.com/oauth2/authorize?client_id={app_id}&scope=bot%20applications.commands&permissions=8"
            cmd_count = len(self.bot.tree.get_commands())

            embed = discord.Embed(title="🤖 Metadata Técnica de Discord", color=0x5865f2)
            embed.add_field(name="Bot Tag", value=f"`{self.bot.user}`", inline=True)
            embed.add_field(name="Application ID", value=f"`{app_id}`", inline=True)
            embed.add_field(name="Guild ID", value=f"`{guild_id}`", inline=True)
            embed.add_field(name="Comandos Registrados", value=f"`{cmd_count}` comandos slash", inline=True)
            embed.add_field(name="URL de Invitación", value=f"[Autorizar Bot]({invite_url})", inline=False)
            await interaction.followup.send(embed=embed)

    # ── 2. Traditional Prefix Commands Registration (!status, !positions, etc.) ──

    def _setup_prefix_commands(self):
        bot = self.bot

        @bot.command(name="help", aliases=["ayuda"])
        async def cmd_help(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            embed = self._build_help_embed()
            await ctx.send(embed=embed)

        @bot.command(name="status", aliases=["estado"])
        async def cmd_status(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    st = await asyncio.to_thread(self.trading_client.get_status)
                    embed = self._build_status_embed(st)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en status: {e}")
                    await ctx.send(f"⚠️ Error obteniendo estado: {e}")

        @bot.command(name="positions", aliases=["pos", "posiciones"])
        async def cmd_positions(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    pos_data = await asyncio.to_thread(self.trading_client.get_positions)
                    curr = await asyncio.to_thread(self._get_account_currency)
                    embed, err_msg = self._build_positions_embed(pos_data, currency=curr)
                    if embed:
                        await ctx.send(embed=embed)
                    else:
                        await ctx.send(err_msg or "ℹ️ Sin posiciones abiertas.")
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en positions: {e}")
                    await ctx.send(f"⚠️ Error obteniendo posiciones: {e}")

        @bot.command(name="signals", aliases=["senales"])
        async def cmd_signals(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    res = await asyncio.to_thread(self.trading_client.get_signals)
                    embed = self._build_signals_embed(res)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en signals: {e}")
                    await ctx.send(f"⚠️ Error al consultar señales: {e}")

        @bot.command(name="close_position", aliases=["close", "cerrar"])
        async def cmd_close_position(ctx, ticket: int):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            try:
                view = ClosePositionConfirmView(ticket, self.authorized_user_ids, self.trading_client)
                await ctx.send(
                    f"⚠️ **Confirmación de Seguridad**\n¿Estás seguro de que deseas forzar el cierre de la posición **#{ticket}** en MT5?",
                    view=view
                )
            except Exception as e:
                logger.error(f"[Discord Prefix] Error en close_position: {e}")
                await ctx.send(f"⚠️ Error al cerrar posición: {e}")

        @bot.command(name="equity", aliases=["balance", "cuenta"])
        async def cmd_equity(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    res = await asyncio.to_thread(self.trading_client.get_equity)
                    embed, err_msg = self._build_equity_embed(res)
                    if embed:
                        await ctx.send(embed=embed)
                    else:
                        await ctx.send(err_msg or "❌ Error obteniendo datos de cuenta.")
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en equity: {e}")
                    await ctx.send(f"⚠️ Error al consultar equity: {e}")

        @bot.command(name="risk", aliases=["riesgo"])
        async def cmd_risk(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    res = await asyncio.to_thread(self.trading_client.get_risk)
                    curr = await asyncio.to_thread(self._get_account_currency)
                    embed = self._build_risk_embed(res, currency=curr)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en risk: {e}")
                    await ctx.send(f"⚠️ Error al consultar telemetría de riesgo: {e}")

        @bot.command(name="journal", aliases=["diario"])
        async def cmd_journal(ctx, days: int = 30):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    res = await asyncio.to_thread(self.trading_client.get_execution_analytics)
                    embed = self._build_journal_embed(res, days)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en journal: {e}")
                    await ctx.send(f"⚠️ Error al consultar diario: {e}")

        @bot.command(name="research", aliases=["lab"])
        async def cmd_research(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    res = await asyncio.to_thread(self.research_client.get_status)
                    embed = self._build_research_embed(res)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en research: {e}")
                    await ctx.send(f"⚠️ Error al consultar research: {e}")

        @bot.command(name="autosignals", aliases=["autosignal", "auto"])
        async def cmd_autosignals(ctx, action: str = "status"):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    act = action.strip().lower()
                    res = await asyncio.to_thread(self.trading_client.toggle_autosignals, act)
                    embed = self._build_autosignals_embed(res)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en autosignals: {e}")
                    await ctx.send(f"⚠️ Error al actualizar autosignals: {e}")

        @bot.command(name="health", aliases=["salud"])
        async def cmd_health(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            async with ctx.typing():
                try:
                    t_online = await asyncio.to_thread(self.trading_client.is_online)
                    r_online = await asyncio.to_thread(self.research_client.is_online)
                    embed = self._build_health_embed(t_online, r_online)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en health: {e}")
                    await ctx.send(f"⚠️ Error al diagnosticar salud: {e}")

        @bot.command(name="version", aliases=["v"])
        async def cmd_version(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.reply("⛔ Acceso denegado: Usuario no autorizado.")
                return
            embed = self._build_version_embed()
            await ctx.send(embed=embed)

        @bot.command(name="ping")
        async def cmd_ping(ctx):
            latency_ms = round(self.bot.latency * 1000) if self.bot.latency else 0
            await ctx.send(f"🏓 Pong! Latencia de Discord Gateway: `{latency_ms} ms`")


def create_commands_service(
    bot: commands.Bot,
    state=None,
    config: Optional[dict] = None,
    trading_client: Optional[TradingClient] = None,
    research_client: Optional[ResearchClient] = None
) -> CommandsService:
    svc = CommandsService(bot, state, config, trading_client=trading_client, research_client=research_client)
    svc.setup_commands()
    return svc
