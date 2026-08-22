# LastEdge App — Telegram Bot Integration

> **Module:** `LastEdge App`  
> **Source File:** `services/telegram_adapter.py`  

---

## 1. Telegram Bot Features

The Telegram Bot runs asynchronous polling (`start_polling()`) and responds to commands using Markdown formatted responses.

### Commands:
- `/start` or `/help` — Main help menu
- `/status` — Unified bot status & MT5 broker connection
- `/positions` — Open positions list
- `/equity` — Account equity, margin, and balance
- `/risk` — Risk Engine v2 telemetry
- `/research` — Strategy Lab experiment summary
- `/health` — Diagnostics of infrastructure
