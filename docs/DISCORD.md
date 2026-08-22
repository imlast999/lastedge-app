# LastEdge App — Discord Bot & Slash Commands

> **Module:** `LastEdge App`  
> **Source File:** `services/commands_refactored.py`  

---

## 1. Supported Slash Commands

| Command | Description | Backend Source |
|---|---|---|
| `/status` | Overall system state, uptime, MT5 status | `TradingClient.get_status()` |
| `/positions` | Open MT5 positions with floating profit | `TradingClient.get_positions()` |
| `/close_position` | Close position by ticket | `TradingClient.close_position()` |
| `/equity` | Balance, equity, margin level | `TradingClient.get_equity()` |
| `/risk` | Risk Engine v2 telemetry | `TradingClient.get_metrics()` |
| `/journal` | Execution analytics & slippage | `TradingClient.get_execution_analytics()` |
| `/research` | Research Database summary | `ResearchClient.get_status()` |
| `/health` | System diagnostics & engine health | `TradingClient.is_online()` |
| `/version` | Deployment version & build | Internal App Metadata |
