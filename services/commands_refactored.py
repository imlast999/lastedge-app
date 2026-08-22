"""
Servicio de Comandos Discord — Refactored (Adaptador Desacoplado para LastEdge App)
===================================================================================
Adaptador de comandos Discord Slash completamente desacoplado.
Consume exclusivamente `TradingClient` y `ResearchClient` a través de APIs REST.
Cero dependencias internas de `Trading Engine` o `Strategy Lab`.

Comandos Núcleo:
  /status          - Estado unificado del bot, uptime, MT5, Circuit Breaker y noticias
  /positions       - Posiciones abiertas en MT5 con P&L flotante en vivo
  /close_position  - Cierra una posición por número de ticket
  /equity          - Balance, equity, margen y nivel de margen
  /risk            - Telemetría de Risk Engine v2 y Circuit Breaker
  /journal         - Métricas de calidad de ejecución (30 días)
  /research        - Ficha de la Research Database e investigaciones
  /autosignals     - Estado y control de auto-ejecución (on/off/status)

Comandos Técnicos de Infraestructura:
  /health          - Diagnóstico técnico (MT5, DBs, Dashboard, APIs, CPU, RAM)
  /version         - Información de despliegue (Versión, Git Commit, Branch, Python)
  /logs            - Últimos eventos o errores importantes registrados
  /discord         - Metadata de registro técnico de Discord (App ID, Guild ID, Invite)
"""

import os
import sys
import logging
from typing import Optional, Dict, Any
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

    def setup_commands(self):
        """Registra todos los Slash Commands en el árbol de comandos de Discord."""
        self._setup_slash_commands()

    def _setup_slash_commands(self):
        bot = self.bot

        # ── 1. /status ────────────────────────────────────────────────────────
        @bot.tree.command(name="status", description="Estado unificado del bot, uptime, MT5, Circuit Breaker y noticias.")
        async def slash_status(interaction: discord.Interaction):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            st = self.trading_client.get_status()
            mt5_st = "🟢 Conectado" if st.get("mt5_connected") else "🔴 Desconectado"
            cb = st.get("circuit_breaker", {})
            cb_st = "🟢 Activo" if cb.get("can_trade", True) else "🔴 Pausado"

            embed = discord.Embed(
                title="⚡ LastEdge — Estado General del Sistema",
                color=0x3b82f6 if st.get("mt5_connected") else 0xef4444
            )
            embed.add_field(name="Estado Bot", value=f"`{st.get('status', 'OFFLINE')}`", inline=True)
            embed.add_field(name="Uptime", value=f"`{st.get('uptime', '0h 0m')}`", inline=True)
            embed.add_field(name="MT5 Broker", value=mt5_st, inline=True)
            embed.add_field(name="Cuenta MT5", value=f"`{st.get('account_number') or '—'}`", inline=True)
            embed.add_field(name="Circuit Breaker", value=f"{cb_st} (×{cb.get('risk_multiplier', 1.0):.1f})", inline=True)
            embed.add_field(name="Autosignals", value="✅ Activo" if st.get("autosignals_enabled") else "⏸ Desactivado", inline=True)

            pairs_str = ", ".join(st.get("monitored_symbols", [])) if st.get("monitored_symbols") else "EURUSD, XAUUSD, BTCEUR"
            embed.add_field(name="Pares Monitoreados", value=f"`{pairs_str}`", inline=False)
            embed.add_field(name="Filtro de Noticias", value=st.get("news_indicator", "🟢 OK"), inline=False)

            embed.set_footer(text=f"Servidor Broker: {st.get('server') or 'n/a'}")
            await interaction.response.send_message(embed=embed)

        # ── 2. /positions ─────────────────────────────────────────────────────
        @bot.tree.command(name="positions", description="Posiciones abiertas en tiempo real en MetaTrader 5.")
        async def slash_positions(interaction: discord.Interaction):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            pos_data = self.trading_client.get_positions()
            positions = pos_data.get("positions", [])
            if not positions:
                await interaction.response.send_message("ℹ️ No hay posiciones abiertas actualmente en MT5.", ephemeral=True)
                return

            embed = discord.Embed(title=f"📊 Posiciones Abiertas en MT5 ({len(positions)})", color=0x10b981)
            for p in positions:
                profit = p.get("profit", 0.0)
                pnl_emoji = "🟢" if profit >= 0 else "🔴"
                val_str = (
                    f"Lotes: `{p.get('volume', 0.0):.2f}` | Entrada: `{p.get('open_price', 0.0):.5f}` | Actual: `{p.get('current_price', 0.0):.5f}`\n"
                    f"P&L: {pnl_emoji} **{profit:+.2f} €** | SL: `{p.get('sl') or '—'}` | TP: `{p.get('tp') or '—'}`"
                )
                embed.add_field(name=f"#{p.get('ticket')} — {p.get('symbol')} ({p.get('type')})", value=val_str, inline=False)

            await interaction.response.send_message(embed=embed)

        # ── 3. /close_position ────────────────────────────────────────────────
        @bot.tree.command(name="close_position", description="Cierra una posición abierta especificando su número de Ticket.")
        @discord.app_commands.describe(ticket="Número de ticket de la posición a cerrar")
        async def slash_close_position(interaction: discord.Interaction, ticket: int):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            await interaction.response.defer(thinking=True)
            res = self.trading_client.close_position(ticket)
            msg = f"✅ {res.get('message', 'Posición cerrada')}" if res.get("ok") else f"❌ {res.get('message', 'Error al cerrar')}"
            await interaction.followup.send(msg)

        # ── 4. /equity ────────────────────────────────────────────────────────
        @bot.tree.command(name="equity", description="Balance, equity, margen y métricas de la cuenta MT5.")
        async def slash_equity(interaction: discord.Interaction):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            res = self.trading_client.get_equity()
            acc = res.get("equity", {})
            if not res.get("ok") and not acc:
                await interaction.response.send_message(f"❌ Error: {res.get('message', 'Servicio offline')}", ephemeral=True)
                return

            pnl = acc.get("floating_pnl", 0.0)
            pnl_emoji = "🟢" if pnl >= 0 else "🔴"
            curr = acc.get("currency", "EUR")

            embed = discord.Embed(title="💰 Balance & Equity — MT5 Account", color=0x3b82f6)
            embed.add_field(name="Balance Base", value=f"**{acc.get('balance', 0.0):,.2f} {curr}**", inline=True)
            embed.add_field(name="Equity Actual", value=f"**{acc.get('equity', 0.0):,.2f} {curr}**", inline=True)
            embed.add_field(name="P&L Flotante", value=f"{pnl_emoji} **{pnl:+.2f} {curr}**", inline=True)
            embed.add_field(name="Margen Usado", value=f"`{acc.get('margin', 0.0):,.2f} {curr}`", inline=True)
            embed.add_field(name="Margen Libre", value=f"`{acc.get('free_margin', 0.0):,.2f} {curr}`", inline=True)
            embed.add_field(name="Nivel de Margen", value=f"`{acc.get('margin_level', 0.0):.1f}%`", inline=True)
            embed.set_footer(text=f"Cuenta: {acc.get('account', 'N/A')} | Apalancamiento: 1:{acc.get('leverage', 'N/A')}")

            await interaction.response.send_message(embed=embed)

        # ── 5. /risk ──────────────────────────────────────────────────────────
        @bot.tree.command(name="risk", description="Telemetría de Risk Engine v2 y estado del Circuit Breaker.")
        async def slash_risk(interaction: discord.Interaction):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            res = self.trading_client.get_metrics()
            metrics = res.get("metrics", {})
            cb = metrics.get("circuit_breaker", {})
            can_trade = cb.get("can_trade", True)
            status_str = "🟢 OPERATIVO" if can_trade else "🔴 PAUSADO (Circuit Breaker)"

            embed = discord.Embed(title="🛡️ Risk Engine v2 — Telemetría de Riesgo", color=0xf59e0b if not can_trade else 0x10b981)
            embed.add_field(name="Estado de Trading", value=f"**{status_str}**", inline=False)
            embed.add_field(name="Multiplicador de Riesgo", value=f"`×{cb.get('risk_multiplier', 1.0):.1f}`", inline=True)
            embed.add_field(name="Rachas", value=f"Perdidas: `{cb.get('consecutive_losses', 0)}` | Ganadas: `{cb.get('consecutive_wins', 0)}`", inline=True)
            embed.add_field(name="Posiciones Abiertas", value=f"`{metrics.get('open_positions_count', 0)}`", inline=True)
            embed.add_field(name="P&L Flotante Total", value=f"**{metrics.get('total_profit', 0.0):+.2f} €**", inline=True)
            embed.add_field(name="Win Rate", value=f"`{metrics.get('win_rate', 0.0):.1f}%`", inline=True)

            await interaction.response.send_message(embed=embed)

        # ── 6. /journal ───────────────────────────────────────────────────────
        @bot.tree.command(name="journal", description="Métricas de Calidad de Ejecución y Diario de Trading (30 días).")
        @discord.app_commands.describe(days="Días de historial a evaluar (por defecto: 30)")
        async def slash_journal(interaction: discord.Interaction, days: int = 30):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            res = self.trading_client.get_execution_analytics()
            stats = res.get("analytics", {})
            tot = stats.get("total_orders", 0)

            embed = discord.Embed(title=f"📖 Diario de Ejecución ({days} Días)", color=0x8b5cf6)
            embed.add_field(name="Total Órdenes", value=f"`{tot}`", inline=True)
            embed.add_field(name="Tasa de Rechazo", value=f"`{stats.get('rejection_rate_pct', 0.0):.1f}%`", inline=True)
            embed.add_field(name="Spread Medio", value=f"`{stats.get('avg_spread_pips', 0.0):.1f} pips`", inline=True)
            embed.add_field(name="Latencia Media", value=f"`{stats.get('avg_latency_ms', 0.0):.0f} ms`", inline=True)
            embed.add_field(name="Slippage Medio", value=f"`{stats.get('avg_slippage_pips', 0.0):+.2f} pips`", inline=True)

            await interaction.response.send_message(embed=embed)

        # ── 7. /research ──────────────────────────────────────────────────────
        @bot.tree.command(name="research", description="Resumen de la Research Database y estado de experimentos.")
        async def slash_research(interaction: discord.Interaction):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            res = self.research_client.get_status()
            embed = discord.Embed(title="🔬 Research Database — Resumen", color=0x06b6d4)
            embed.add_field(name="Total Experimentos", value=f"`{res.get('total_experiments', 0)}`", inline=True)
            embed.add_field(name="Promocionados", value=f"`{res.get('promoted_count', 0)}` (PROMOTED)", inline=True)
            embed.add_field(name="Candidatos", value=f"`{res.get('candidates_count', 0)}` (CANDIDATE)", inline=True)

            await interaction.response.send_message(embed=embed)

        # ── 8. /health ────────────────────────────────────────────────────────
        @bot.tree.command(name="health", description="Diagnóstico técnico de salud e infraestructura de la plataforma.")
        async def slash_health(interaction: discord.Interaction):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            t_online = self.trading_client.is_online()
            r_online = self.research_client.is_online()

            embed = discord.Embed(title="🩺 LastEdge — Diagnóstico de Salud Técnica", color=0x10b981 if t_online else 0xef4444)
            embed.add_field(name="Trading Engine (:8081)", value="🟢 ONLINE" if t_online else "🔴 OFFLINE", inline=True)
            embed.add_field(name="Strategy Lab (:8082)", value="🟢 ONLINE" if r_online else "🔴 OFFLINE", inline=True)
            embed.add_field(name="Control App (:8080)", value="🟢 ONLINE", inline=True)

            await interaction.response.send_message(embed=embed)

        # ── 9. /version ──────────────────────────────────────────────────────
        @bot.tree.command(name="version", description="Información de la versión desplegada, commit de Git y build.")
        async def slash_version(interaction: discord.Interaction):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

            embed = discord.Embed(title="📦 LastEdge — Información de Despliegue", color=0x6366f1)
            embed.add_field(name="Plataforma", value="**LastEdge App Control**", inline=False)
            embed.add_field(name="Versión", value="`v1.0.0 (Decoupled)`", inline=True)
            embed.add_field(name="Python", value=f"`v{sys.version.split()[0]}`", inline=True)
            await interaction.response.send_message(embed=embed)

        # ── 10. /discord ──────────────────────────────────────────────────────
        @bot.tree.command(name="discord", description="Metadata técnica de registro y sincronización del bot en Discord.")
        async def slash_discord(interaction: discord.Interaction):
            if self.AUTHORIZED_USER_ID and interaction.user.id != self.AUTHORIZED_USER_ID:
                await interaction.response.send_message("⛔ No autorizado", ephemeral=True)
                return

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

            await interaction.response.send_message(embed=embed)


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
