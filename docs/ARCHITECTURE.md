# LastEdge App — Architecture & Subsystems

> **Module:** `LastEdge App`  
> **Role:** Unified Control Plane, User Interfaces & Bot Adapters  

---

## 1. System Overview

`LastEdge App` is completely decoupled from backend trading internals. It acts as an API aggregator and presentation layer across web, mobile, Discord, and Telegram.

```text
               ┌──────────────────────────────┐
               │    Users / Web / Mobile      │
               └──────────────┬───────────────┘
                              │
               ┌──────────────▼───────────────┐
               │     dashboard_server.py      │
               │   (Port 8080 HTTP Server)    │
               └──────────────┬───────────────┘
                              │
  ┌───────────────────────────┴───────────────────────────┐
  │                                                       │
  ▼                                                       ▼
┌──────────────────┐                            ┌──────────────────┐
│  TradingClient   │                            │  ResearchClient  │
│  (HTTP REST)     │                            │  (HTTP REST)     │
└─────────┬────────┘                            └────────┬─────────┘
          │                                              │
          ▼                                              ▼
┌──────────────────┐                            ┌──────────────────┐
│  Trading Engine  │                            │   Strategy Lab   │
│   (Port 8081)    │                            │   (Port 8082)    │
└──────────────────┘                            └──────────────────┘
```

---

## 2. Core Modules Breakdown

### 2.1 Web Dashboard Server (`services/dashboard_server.py`)
- Standard library threaded HTTP server on port `8080`.
- Serves static assets (`dashboard/index.html`, `script.js`, `style.css`).
- Proxies API requests to `TradingClient` and `ResearchClient` with concurrent health probing.

### 2.2 Client Layer (`services/clients/`)
- **`trading_client.py`**: Queries `Trading Engine` (:8081). Handles timeouts and produces graceful fallback responses when offline.
- **`research_client.py`**: Queries `Strategy Lab` (:8082). Handles timeouts and returns empty candidate/experiment lists when offline.

### 2.3 Messaging Adapters
- **`services/telegram_adapter.py`**: Long-polling asynchronous Telegram Bot adapter.
- **`services/commands_refactored.py`**: Discord Slash Command adapter.

### 2.4 Mobile Application (`mobile-app/`)
- React Native / Expo application with tab navigation (`trades`, `lab`, `settings`).
