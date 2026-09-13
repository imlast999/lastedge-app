# LastEdge App — Discord & Telegram Bot Adapters

> **Module:** `LastEdge App`  
> **Source Files:** `services/commands_refactored.py`, `services/telegram_adapter.py`, `services/notification_dispatcher.py`  
> **Status:** Production Standard  

---

## 1. Overview

LastEdge App integrates both Discord and Telegram messaging platforms to provide real-time trade telemetry, risk monitoring, and remote operational control over Trading Engine and Strategy Lab.

```text
[Trading Engine / Lab] ──► [NotificationDispatcher] ──┬──► [Discord Webhook / Bot]
                                                      └──► [Telegram Bot API]
```

---

## 2. Discord Bot & Slash Commands (`services/commands_refactored.py`)

Interacts via asynchronous Discord Slash Commands:

| Command | Description | Backend Source |
|---|---|---|
| `/status` | Overall system state, uptime, MT5 connection status | `TradingClient.get_status()` |
| `/positions` | Active MT5 positions with floating PnL | `TradingClient.get_positions()` |
| `/close_position` | Emergency close of position by ticket | `TradingClient.close_position()` |
| `/equity` | Account balance, equity, free margin, margin level | `TradingClient.get_equity()` |
| `/risk` | Risk Engine v2 active exposure metrics | `TradingClient.get_metrics()` |
| `/journal` | Execution analytics, slippage, and fill telemetry | `TradingClient.get_execution_analytics()` |
| `/research` | Strategy Lab experiment summary and candidate count | `ResearchClient.get_status()` |
| `/health` | Subsystem diagnostics and engine heartbeat | `TradingClient.is_online()` |

---

## 3. Telegram Bot Integration (`services/telegram_adapter.py`)

Runs non-blocking async long polling with rich Markdown message formatting:

### Supported Commands:
- `/start`, `/help` — Interactive help menu.
- `/status` — Real-time engine and broker health.
- `/positions` — Formatted list of open trades with current PnL.
- `/equity` — Account equity and margin utilization.
- `/risk` — Portfolio risk and drawdown status.
- `/research` — Strategy Lab research status.

### Security:
- Enforces strict `TELEGRAM_CHAT_ID` authorization to ensure only authorized operators can execute commands or receive broadcasts.
