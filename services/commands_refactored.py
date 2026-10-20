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
  /close_position - Cierra una posición por número de ticket (/close_position <ticket> o !close <ticket>)
  /equity         - Balance, equity, margen y nivel de margen
  /risk           - Telemetría de Risk Engine v2 y Circuit Breaker
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
from typing import Optional, Dict, Any, Tuple
import discord
from discord.ext import commands

from services.clients.trading_client import get_trading_client, TradingClient
from services.clients.research_client import get_research_client, ResearchClient

logger = logging.getLogger(__name__)


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
        self.AUTHORIZED_USER_ID = self.config.get('AUTHORIZED_USER_ID', 0)
        self.trading_client = trading_client or get_trading_client()
        self.research_client = research_client or get_research_client()

    def _is_authorized(self, user_id: int) -> bool:
        """Verifica si el usuario está autorizado para operar el bot."""
        if not self.AUTHORIZED_USER_ID or self.AUTHORIZED_USER_ID == 0:
            return True
        return user_id == self.AUTHORIZED_USER_ID

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

    def _build_positions_embed(self, pos_data: Dict[str, Any]) -> Tuple[Optional[discord.Embed], Optional[str]]:
        positions = pos_data.get("positions", [])
        if not positions:
            return None, "ℹ️ No hay posiciones abiertas actualmente en MT5."

        embed = discord.Embed(
            title=f"📊 Posiciones Abiertas en MT5 ({len(positions)})",
            color=0x10b981,
            timestamp=datetime.now(timezone.utc)
        )
        for p in positions:
            profit = p.get("profit", 0.0)
            pnl_emoji = "🟢" if profit >= 0 else "🔴"
            val_str = (
                f"Lotes: `{p.get('volume', 0.0):.2f}` | Entrada: `{p.get('open_price', 0.0):.5f}` | Actual: `{p.get('current_price', 0.0):.5f}`\n"
                f"P&L: {pnl_emoji} **{profit:+.2f} €** | SL: `{p.get('sl') or '—'}` | TP: `{p.get('tp') or '—'}`"
            )
            embed.add_field(name=f"#{p.get('ticket')} — {p.get('symbol')} ({p.get('type')})", value=val_str, inline=False)
        return embed, None

    def _build_equity_embed(self, res: Dict[str, Any]) -> Tuple[Optional[discord.Embed], Optional[str]]:
        acc = res.get("equity", {})
        if not res.get("ok") and not acc:
            return None, f"❌ Error: {res.get('message', 'Servicio offline')}"

        pnl = acc.get("floating_pnl", 0.0)
        pnl_emoji = "🟢" if pnl >= 0 else "🔴"
        curr = acc.get("currency", "EUR")

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

    def _build_risk_embed(self, res: Dict[str, Any]) -> discord.Embed:
        metrics = res.get("metrics", {})
        cb = metrics.get("circuit_breaker", {})
        can_trade = cb.get("can_trade", True)
        status_str = "🟢 OPERATIVO" if can_trade else "🔴 PAUSADO (Circuit Breaker)"

        embed = discord.Embed(
            title="🛡️ Risk Engine v2 — Telemetría de Riesgo",
            color=0xf59e0b if not can_trade else 0x10b981,
            timestamp=datetime.now(timezone.utc)
        )
        embed.add_field(name="Estado de Trading", value=f"**{status_str}**", inline=False)
        embed.add_field(name="Multiplicador de Riesgo", value=f"`×{cb.get('risk_multiplier', 1.0):.1f}`", inline=True)
        embed.add_field(name="Rachas", value=f"Perdidas: `{cb.get('consecutive_losses', 0)}` | Ganadas: `{cb.get('consecutive_wins', 0)}`", inline=True)
        embed.add_field(name="Posiciones Abiertas", value=f"`{metrics.get('open_positions_count', 0)}`", inline=True)
        embed.add_field(name="P&L Flotante Total", value=f"**{metrics.get('total_profit', 0.0):+.2f} €**", inline=True)
        embed.add_field(name="Win Rate", value=f"`{metrics.get('win_rate', 0.0):.1f}%`", inline=True)
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
            description="Puedes utilizar comandos tanto con slash (`/status`) como con prefijo tradicional (`!status`).",
            color=0x3b82f6
        )
        embed.add_field(name="📊 Operativa", value="`/status`, `/positions`, `/equity`, `/risk`, `/close_position <ticket>`", inline=False)
        embed.add_field(name="⚙️ Control y Señales", value="`/autosignals [on|off|status]`, `/journal [días]`, `/research`", inline=False)
        embed.add_field(name="🩺 Diagnóstico y Red", value="`/health`, `/version`, `/ping`, `/logs`, `/discord`", inline=False)
        embed.set_footer(text="LastEdge Quantitative Trading Platform")
        return embed

    # ── 1. Slash Commands Registration ────────────────────────────────────────

    def _setup_slash_commands(self):
        bot = self.bot

        @bot.tree.command(name="help", description="Muestra el menú de ayuda con todos los comandos disponibles.")
        async def slash_help(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=False)
            embed = self._build_help_embed()
            await interaction.followup.send(embed=embed)

        @bot.tree.command(name="status", description="Estado unificado del bot, uptime, MT5, Circuit Breaker y noticias.")
        async def slash_status(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
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
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                pos_data = await asyncio.to_thread(self.trading_client.get_positions)
                embed, err_msg = self._build_positions_embed(pos_data)
                if embed:
                    await interaction.followup.send(embed=embed)
                else:
                    await interaction.followup.send(err_msg or "ℹ️ Sin posiciones abiertas.")
            except Exception as e:
                logger.error(f"[Discord Slash] Error en positions: {e}")
                await interaction.followup.send(f"⚠️ Error obteniendo posiciones: {e}")

        @bot.tree.command(name="close_position", description="Cierra una posición abierta especificando su número de Ticket.")
        @discord.app_commands.describe(ticket="Número de ticket de la posición a cerrar")
        async def slash_close_position(interaction: discord.Interaction, ticket: int):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.trading_client.close_position, ticket)
                msg = f"✅ {res.get('message', 'Posición cerrada exitosamente')}" if res.get("ok") else f"❌ {res.get('message', 'Error al cerrar posición')}"
                await interaction.followup.send(msg)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en close_position: {e}")
                await interaction.followup.send(f"⚠️ Error al cerrar posición: {e}")

        @bot.tree.command(name="equity", description="Balance, equity, margen y métricas de la cuenta MT5.")
        async def slash_equity(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
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

        @bot.tree.command(name="risk", description="Telemetría de Risk Engine v2 y estado del Circuit Breaker.")
        async def slash_risk(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.trading_client.get_metrics)
                embed = self._build_risk_embed(res)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en risk: {e}")
                await interaction.followup.send(f"⚠️ Error al consultar telemetría de riesgo: {e}")

        @bot.tree.command(name="journal", description="Métricas de Calidad de Ejecución y Diario de Trading.")
        @discord.app_commands.describe(days="Días de historial a evaluar (por defecto: 30)")
        async def slash_journal(interaction: discord.Interaction, days: int = 30):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.trading_client.get_execution_analytics)
                embed = self._build_journal_embed(res, days)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en journal: {e}")
                await interaction.followup.send(f"⚠️ Error al consultar diario de trading: {e}")

        @bot.tree.command(name="research", description="Resumen de la Research Database y experimentos.")
        async def slash_research(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                res = await asyncio.to_thread(self.research_client.get_status)
                embed = self._build_research_embed(res)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en research: {e}")
                await interaction.followup.send(f"⚠️ Error al consultar Research Database: {e}")

        @bot.tree.command(name="autosignals", description="Consulta o cambia el estado de auto-ejecución de señales.")
        @discord.app_commands.describe(action="Acción: status, on, off")
        async def slash_autosignals(interaction: discord.Interaction, action: str = "status"):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
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
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                t_online = await asyncio.to_thread(self.trading_client.is_online)
                r_online = await asyncio.to_thread(self.research_client.is_online)
                embed = self._build_health_embed(t_online, r_online)
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logger.error(f"[Discord Slash] Error en health: {e}")
                await interaction.followup.send(f"⚠️ Error en health check: {e}")

        @bot.tree.command(name="version", description="Información de la versión desplegada y build.")
        async def slash_version(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=False)
            embed = self._build_version_embed()
            await interaction.followup.send(embed=embed)

        @bot.tree.command(name="ping", description="Comprueba la latencia del bot en Discord.")
        async def slash_ping(interaction: discord.Interaction):
            latency_ms = round(self.bot.latency * 1000) if self.bot.latency else 0
            await interaction.response.send_message(f"🏓 Pong! Latencia de Discord Gateway: `{latency_ms} ms`")

        @bot.tree.command(name="logs", description="Muestra los últimos eventos o advertencias del log.")
        async def slash_logs(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return
            await interaction.response.defer(thinking=False)
            await interaction.followup.send("📋 Los logs del sistema se encuentran activos en `LastEdge App/logs/`.")

        @bot.tree.command(name="discord", description="Metadata técnica de registro y sincronización del bot en Discord.")
        async def slash_discord(interaction: discord.Interaction):
            if not self._is_authorized(interaction.user.id):
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
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
                await ctx.send("⛔ No autorizado")
                return
            embed = self._build_help_embed()
            await ctx.send(embed=embed)

        @bot.command(name="status", aliases=["estado"])
        async def cmd_status(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.send("⛔ No autorizado")
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
                await ctx.send("⛔ No autorizado")
                return
            async with ctx.typing():
                try:
                    pos_data = await asyncio.to_thread(self.trading_client.get_positions)
                    embed, err_msg = self._build_positions_embed(pos_data)
                    if embed:
                        await ctx.send(embed=embed)
                    else:
                        await ctx.send(err_msg or "ℹ️ Sin posiciones abiertas.")
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en positions: {e}")
                    await ctx.send(f"⚠️ Error obteniendo posiciones: {e}")

        @bot.command(name="close_position", aliases=["close", "cerrar"])
        async def cmd_close_position(ctx, ticket: int):
            if not self._is_authorized(ctx.author.id):
                await ctx.send("⛔ No autorizado")
                return
            async with ctx.typing():
                try:
                    res = await asyncio.to_thread(self.trading_client.close_position, ticket)
                    msg = f"✅ {res.get('message', 'Posición cerrada exitosamente')}" if res.get("ok") else f"❌ {res.get('message', 'Error al cerrar posición')}"
                    await ctx.send(msg)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en close_position: {e}")
                    await ctx.send(f"⚠️ Error al cerrar posición: {e}")

        @bot.command(name="equity", aliases=["balance", "cuenta"])
        async def cmd_equity(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.send("⛔ No autorizado")
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
                await ctx.send("⛔ No autorizado")
                return
            async with ctx.typing():
                try:
                    res = await asyncio.to_thread(self.trading_client.get_metrics)
                    embed = self._build_risk_embed(res)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en risk: {e}")
                    await ctx.send(f"⚠️ Error al consultar telemetría de riesgo: {e}")

        @bot.command(name="journal", aliases=["diario"])
        async def cmd_journal(ctx, days: int = 30):
            if not self._is_authorized(ctx.author.id):
                await ctx.send("⛔ No autorizado")
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
                await ctx.send("⛔ No autorizado")
                return
            async with ctx.typing():
                try:
                    res = await asyncio.to_thread(self.research_client.get_status)
                    embed = self._build_research_embed(res)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en research: {e}")
                    await ctx.send(f"⚠️ Error al consultar research: {e}")

        @bot.command(name="autosignals", aliases=["senales", "signals"])
        async def cmd_autosignals(ctx, action: str = "status"):
            if not self._is_authorized(ctx.author.id):
                await ctx.send("⛔ No autorizado")
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
                await ctx.send("⛔ No autorizado")
                return
            async with ctx.typing():
                try:
                    t_online = await asyncio.to_thread(self.trading_client.is_online)
                    r_online = await asyncio.to_thread(self.research_client.is_online)
                    embed = self._build_health_embed(t_online, r_online)
                    await ctx.send(embed=embed)
                except Exception as e:
                    logger.error(f"[Discord Prefix] Error en health: {e}")
                    await ctx.send(f"⚠️ Error en health check: {e}")

        @bot.command(name="version", aliases=["v"])
        async def cmd_version(ctx):
            if not self._is_authorized(ctx.author.id):
                await ctx.send("⛔ No autorizado")
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
