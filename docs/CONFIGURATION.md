# LastEdge App — Configuration Guide

> **Module:** `LastEdge App`  
> **Config File:** `.env`  

---

## 1. Environment Variables (`.env`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `APP_PORT` | `int` | `8080` | Port for the Web Dashboard server. |
| `TRADING_ENGINE_URL` | `str` | `http://localhost:8081` | URL of the LastEdge Trading Engine REST API. |
| `STRATEGY_LAB_URL` | `str` | `http://localhost:8082` | URL of the LastEdge Strategy Lab REST API. |
| `API_TIMEOUT_SECONDS`| `float` | `2.0` | HTTP request timeout for backend queries. |
| `TELEGRAM_BOT_TOKEN` | `str` | *None* | Bot token from @BotFather for Telegram alerts. |
| `TELEGRAM_CHAT_ID` | `str` | *None* | Authorized Telegram chat ID. |
| `DISCORD_BOT_TOKEN` | `str` | *None* | Discord Application Bot token. |
| `DISCORD_GUILD_ID` | `str` | *None* | Target Discord server ID for slash commands. |
| `LOG_LEVEL` | `str` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
