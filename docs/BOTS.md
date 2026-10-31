# LastEdge App — Discord & Telegram Bot Adapters

> **Module:** `LastEdge App`  
> **Source Files:** `services/bot_manager.py`, `services/commands_refactored.py`, `services/telegram_adapter.py`, `services/notification_dispatcher.py`  
> **Status:** Production Standard  

---

## 1. Overview & Architecture

`LastEdge App` provides decoupled messaging bot adapters for both **Discord** and **Telegram**. These bots allow traders and operators to monitor real-time MT5 account telemetry, review risk metrics, receive interactive signal alerts, and execute operational controls remotely without accessing the VPS directly.

```text
┌────────────────────────────────────────────────────────┐
│                      LastEdge App                      │
│                  (services/bot_manager.py)             │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
 ┌─────────────────────────┐ ┌─────────────────────────┐
 │   ACTIVATE_DISCORD_BOT  │ │  ACTIVATE_TELEGRAM_BOT  │
 │     [ on / off ]        │ │      [ on / off ]       │
 └────────────┬────────────┘ └────────────┬────────────┘
              │                           │
              ▼                           ▼
 ┌─────────────────────────┐ ┌─────────────────────────┐
 │       Discord Bot       │ │      Telegram Bot       │
 │   commands_refactored   │ │    telegram_adapter     │
 │  • Slash Commands (/)   │ │  • Polling Commands (/) │
 │  • Text Commands (!)    │ │  • Inline Keyboards     │
 │  • Interactive Views    │ │  • Charts Generation   │
 └─────────────────────────┘ └─────────────────────────┘
```

---

## 2. Bot Activation Switches (`.env`)

You can independently enable or disable either bot directly from the `.env` configuration file using simple `on` / `off` flags:

```env
# ── Bot Activation Switches (on / off) ──────────────────────────────────────────
ACTIVATE_DISCORD_BOT=off
ACTIVATE_TELEGRAM_BOT=on
```

### Operational Modes:
- **Telegram Only** (`ACTIVATE_DISCORD_BOT=off`, `ACTIVATE_TELEGRAM_BOT=on`):
  Telegram bot runs long polling; Discord bot remains completely offline without opening websocket connections or consuming gateway resources.
- **Discord Only** (`ACTIVATE_DISCORD_BOT=on`, `ACTIVATE_TELEGRAM_BOT=off`):
  Discord bot connects to Gateway; Telegram polling is bypassed.
- **Both Enabled** (`on` / `on`):
  Both bots operate concurrently in a dedicated background asyncio thread.
- **Headless Mode** (`off` / `off`):
  Both bots are disabled; the app runs purely as a Web Dashboard and Mobile Gateway with zero background bot overhead.

> [!TIP]
> The parser (`_parse_bot_switch`) supports standard boolean variants case-insensitively (`on`/`off`, `true`/`false`, `1`/`0`, `enabled`/`disabled`), defaulting to `True` if omitted for backwards compatibility.

---

## 3. Discord Bot Integration (`services/commands_refactored.py`)

The Discord adapter interacts via modern Discord Slash Commands (`/`) and traditional prefix commands (`!`):

### Available Commands:
| Command | Aliases | Description | Backend Source |
|---|---|---|---|
| `/help` | `!help`, `!ayuda` | Command directory, usage guide, and operator status | Internal Embed |
| `/status` | `!status`, `!estado` | System uptime, MT5 broker connectivity, Circuit Breaker | `TradingClient.get_status()` |
| `/positions` | `!positions`, `!pos` | Open positions with dynamic account currency and total P&L | `TradingClient.get_positions()` |
| `/signals` | `!signals`, `!senales` | Recent trading signals, confidence, execution status, and R:R | `TradingClient.get_signals()` |
| `/chart` | `!chart`, `!grafico`, `!c` | Interactive live candlestick chart with in-place refresh button | `get_chart_for_position()` / `get_chart_for_signal()` |
| `/close_position` | `!close`, `!cerrar` | Emergency close with interactive confirmation view | `TradingClient.close_position()` |
| `/equity` | `!equity`, `!balance` | Account balance, equity, free margin, margin level | `TradingClient.get_equity()` |
| `/risk` | `!risk`, `!riesgo` | Risk Engine v2 telemetry, portfolio capacity, broker safeguards | `TradingClient.get_risk()` |
| `/journal` | `!journal`, `!diario` | Execution analytics, slippage telemetry, fill rate | `TradingClient.get_execution_analytics()` |
| `/research` | `!research`, `!lab` | Strategy Lab experiments and candidate strategy counts | `ResearchClient.get_status()` |
| `/autosignals` | `!autosignals`, `!auto` | Query or toggle automated signal execution (`status/on/off`) | `TradingClient.toggle_autosignals()` |
| `/health` | `!health`, `!salud` | Health diagnostics across all 3 ecosystem microservices | Internal Health Check |
| `/version` | `!version`, `!v` | Deployment information, architecture, Python version | Deployment Telemetry |
| `/ping` | `!ping` | Discord Gateway round-trip latency in milliseconds | Bot Client Latency |
| `/logs` | — | Pointer to system log directory | Internal Logs |
| `/discord` | — | Technical gateway metadata, guild registration info | Internal Metadata |

### Security & Access Control:
- **Fail-Safe Whitelist**: Restricted to user IDs specified in `AUTHORIZED_USER_ID` or `AUTHORIZED_USER_IDS` (comma-separated list).
- **Default Deny**: If no authorized user is configured in `.env`, all commands are automatically rejected with `⛔ Acceso denegado: Usuario no autorizado.`.

### Interactive UI Components:
- **`ClosePositionConfirmView`**: Two-button confirmation (`[⚠️ Confirmar Cierre]` and `[✖️ Cancelar]`) prevents accidental trade closures from typos.
- **`DiscordSignalView`**: Real-time signal alert embeds include inline `[✅ Aprobar]` and `[❌ Rechazar]` buttons for 1-click execution into MT5.
- **`ChartRefreshView`**: Attaches an interactive `[🔄 Refrescar Gráfico]` button. When clicked, it generates a fresh MT5 candle chart and updates the original message attachment in-place without polluting the Discord channel with duplicate images.

---

## 4. Telegram Bot Integration (`services/telegram_adapter.py`)

Runs non-blocking async long polling with rich Markdown formatting, bilingual support (`en` / `es`), and native chart generation.

### Supported Commands:
- `/start`, `/help` — Interactive help menu with operational inline buttons.
- `/status` — Engine health, MT5 connection, uptime, and active trading mode.
- `/autonomous` (aliases: `/autonomo`, `/handsfree`) — Toggle 100% Autonomous Hands-Free mode vs. Hybrid Review mode.
- `/positions` — Open positions table with live floating P&L and inline chart buttons.
- `/chart [symbol]` or `/chart_{ticket}` — Generates institutional dark-theme candlesticks with Entry/SL/TP overlays and an inline `[🔄 Refresh Chart]` button.

### Interactive In-Place Chart Refresh:
- **Zero-Flood In-Place Updates**: All charts sent by the bot (via `/chart`, `/chart_{ticket}`, or deep links from `/positions`) attach an inline `[🔄 Refrescar Gráfico]` / `[🔄 Refresh Chart]` button.
- **Native `editMessageMedia` Integration**: Tapping the refresh button immediately fires an answer callback toast (`🔄 Refreshing live chart...`) and updates the existing photo and caption in-place using Telegram's native `editMessageMedia` endpoint. This allows traders to continuously track active positions from mobile without flooding the chat with duplicate images.
- **Trade Lifecycle Awareness**: If the position is closed or stopped out in MT5 while tracking, tapping the refresh button gracefully informs the user that the ticket is no longer open.
- `/equity` — Live balance, equity, margin used, free margin, and margin level.
- `/risk` — Portfolio risk utilization, streak telemetry, and Circuit Breaker status.
- `/journal` — Order fill metrics, rejection rate, and slippage telemetry.
- `/research` — Strategy Lab experiment database summary.
- `/autosignals [on|off|status]` — Scanner execution control.

### Security:
- Enforces strict `TELEGRAM_CHAT_ID` authorization. Messages from unauthorized users are rejected immediately.
