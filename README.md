<div align="center">

<img src="branding/LastEdge_Logo.png" alt="LastEdge App Logo" width="160">

# LastEdge App

[![App & Control Plane CI](https://github.com/imlast999/lastedge-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/imlast999/lastedge-app/actions/workflows/ci.yml)
[![Build Android APK](https://github.com/imlast999/lastedge-app/actions/workflows/build-apk.yml/badge.svg)](https://github.com/imlast999/lastedge-app/actions/workflows/build-apk.yml)
[![Download APK](https://img.shields.io/badge/Download%20APK-v1.1.55-brightgreen?logo=android)](https://github.com/imlast999/lastedge-app/actions/runs/40590182509)
[![Tests](https://img.shields.io/badge/Tests-39%2F39%20Passed-success)](https://github.com/imlast999/lastedge-app)

> **Repository:** [`imlast999/lastedge-app`](https://github.com/imlast999/lastedge-app)  
> **Role:** Unified Control Center, Web Dashboard, Mobile Application & Bot Adapters  
> **Status:** Production Ready  
> **Tests:** 39 / 39 Passed (100% Green)  

</div>

---

> [!NOTE]
> **Part of the [LastEdge](https://github.com/imlast999/LastEdge) Ecosystem**  
> This repository is the control and presentation layer of the **LastEdge** quantitative trading platform. While it can run independently (using built-in graceful degradation and cached states), **we strongly recommend running the complete LastEdge suite** via the main orchestrator repository ([`imlast999/LastEdge`](https://github.com/imlast999/LastEdge)) using its automated clone script (`setup.bat` / `clone_repos.bat`) to unlock real-time live trading feeds, interactive research controls, and instant bot alerts.

---

## 1. Overview

**LastEdge App** is the control plane and user-facing monitoring suite for the LastEdge quantitative platform. It provides real-time visibility and control into live trading positions, account metrics, risk telemetry, research experiments, and messaging alerts.

### Key Capabilities:
- **Ecosystem Onboarding Wizard & Adaptive Modular UI**: Institutional setup dialog prompted on first launch (Web Dashboard & Mobile App) querying active ecosystem components (⚡ `Trading Engine`, 🧪 `Strategy Lab`). Strict validation enforces minimum 1 active module. The interface dynamically adapts navigation tabs and suppresses irrelevant offline alerts, persisting preferences across app updates via `localStorage` and `AsyncStorage` (`@lastedge_ecosystem_modules_v1`).
- **Web Dashboard (Bento Grid 2.0)**: Modern, responsive glassmorphism dashboard running on port `8080` (`services/dashboard_server.py`) with real-time Chart.js equity tracking, embedded TradingView Lightweight Charts, and educational financial tooltips.
- **Mobile Native Application (React Native / Expo 54)**: Production-ready Android & iOS client featuring biometric authentication, 1-tap MT5 signal approval, live 1-second countdown tickers, and a 3-section Trades manager (`Abiertas`, `Por aceptar`, `Cerradas`).
- **Direct APK Release**: Automated GitHub Actions workflow compiling signed release APKs: [**`LastEdge-v1.1.55.apk`**](https://github.com/imlast999/lastedge-app/actions/runs/40590182509).
- **Confidence-Aware Signal Hub**: Coordinates with Trading Engine's multi-tier scoring matrix to route auto-executed trades (`HIGH`/`VERY_HIGH` $\ge 0.67$) directly to live positions, while holding discretionary setups (`MEDIUM` $0.60 - 0.66$) in the 1-click approval queue.
- **Decoupled Architecture**: Communicates exclusively via HTTP REST APIs with `Trading Engine` (:8081) and `Strategy Lab` (:8082).
- **Graceful Degradation**: 100% crash-proof operation; displays clear status badges and offline fallbacks when backend engines are temporarily offline.
- **Messaging Adapters & Control Center**: Decoupled Discord Slash command adapter (`services/commands_refactored.py`) and Telegram Bot polling adapter (`services/telegram_adapter.py`) with native command autocomplete (`setMyCommands`) in English and Spanish.
- **Visual Technical Chart Engine**: TradingView-styled dark mode (`#090d16`) chart generator (`services/chart_helper.py`, `services/charts.py`) with 80 H1 candles, dynamic Y-axis scaling (+8% padding ensuring Entry, SL & TP are in frame), EMA50/EMA200, and shaded Risk/Reward zone boxes.
- **Deep Linking & On-Demand Position Charts**: Direct bot triggers (`t.me/LastEdgeBot?start=chart_{ticket}`) and `/chart_{ticket}` commands for instant visual chart generation from open MT5 positions.
- **Interactive Flow Modals**: Live Trade Flow modals inside the Bento Grid and Mobile App with real-time candle feeds, Entry/SL/TP horizontal overlays, and live tick polling.

---

## 2. Signal Routing & Approval Workflow

The App coordinates with the Trading Engine's deterministic 4-tier confidence scoring:

| Signal Tier | Confluence Score | App UI Presentation | User / Bot Action |
| :--- | :---: | :--- | :--- |
| **`VERY_HIGH`** | **`0.85 – 1.00`** | **Active Positions Table** | Executed automatically in MT5. App displays live P&L, trailing stop, and interactive chart button. |
| **`HIGH`** | **`0.67 – 0.84`** | **Active Positions Table** | Executed automatically in MT5 (optimized $\ge 0.67$ gate). Direct execution with zero latency. |
| **`MEDIUM`** | **`0.60 – 0.66`** | **Pending Signals Queue** | Displays 10-minute TTL countdown timer in Hybrid Mode. Suppressed automatically when 100% Autonomous Mode is ON. |
| **`LOW`** | **`< 0.60`** | **Filtered Out (Suppressed)** | Never displayed in UI or forwarded to notification channels. 100% noise suppression. |

### 🤖 Autonomous Mode Control (Web, App & Telegram)

The App provides real-time control over the Trading Engine's operational mode:
- **Interactive Header Pill & Signal Toggle**: Toggle between `100% AUTÓNOMO` (green) and `MODO HÍBRIDO` (amber) with 1 click.
- **Telegram Bot Integration**: Use `/autonomous` or inline menu buttons to toggle modes remotely.
- **REST Gateway**: Proxies `GET /api/trading/autonomous-mode` and `POST /api/trading/autonomous-mode` directly to the Trading Engine with full state persistence.

---

## 3. Ecosystem & Sister Repositories

LastEdge App sits at the presentation layer of the LastEdge ecosystem, connecting traders and researchers with the underlying engines:

| Repository | Role | Integration Point |
| :--- | :--- | :--- |
| 🧭 [**LastEdge (Main Suite)**](https://github.com/imlast999/LastEdge) | Ecosystem Orchestrator & CLI | **Unified Workspace**: Automated setup script (`setup.bat` / `clone_repos.bat`) to synchronize and run the complete three-repository trading suite. |
| ⚡ [**LastEdge Trading Engine**](https://github.com/imlast999/lastedge-trading-engine) | MT5 Execution & Risk Engine v2 | **Live Execution Telemetry**: App connects via [`services/clients/trading_client.py`](services/clients/trading_client.py) to `http://localhost:8081` to display active positions, daily drawdown, trailing stops, broker quality metrics, and approve trade execution. |
| 🧪 [**LastEdge Strategy Lab**](https://github.com/imlast999/lastedge-strategy-lab) | Quantitative Research & Validation | **Research Telemetry & Control**: App connects via [`services/clients/research_client.py`](services/clients/research_client.py) to `http://localhost:8082` to display backtest metrics, candidate statuses, and trigger research pipeline jobs. |

If either backend engine is offline, LastEdge App continues serving user requests smoothly using cached telemetry and graceful fallback states.

---

## 4. Architecture & Directory Structure

```text
LastEdge App/
├── build_apk.bat                   # Windows CLI launcher for Android APK compilation
├── build_apk.py                    # Interactive Python build, diagnostic & ADB deployer
├── dashboard/                      # Web Dashboard frontend (HTML, CSS, JS, Lightweight Charts)
├── mobile-app/                     # React Native / Expo mobile application
│   └── artifacts/mobile/
│       ├── app/                    # Expo Router tabs (index, trades, lab, settings)
│       ├── components/             # TradeFlowModal, SignalCard, PedagogicalPillarsSuite
│       ├── context/                # TradingContext, SettingsContext
│       └── services/               # mobileApi, researchApi, notifications
├── services/
│   ├── dashboard_server.py         # Standalone Web Dashboard HTTP server (:8080)
│   ├── telegram_adapter.py         # Decoupled Telegram Bot adapter
│   ├── commands_refactored.py      # Decoupled Discord Slash command adapter
│   ├── notification_dispatcher.py  # Central notification router
│   ├── chart_helper.py             # TradingView dark-theme chart generator (mplfinance)
│   ├── charts.py                   # Chart generation and MT5 candle adapters
│   ├── i18n.py                     # Multi-language support (ES, EN)
│   └── clients/                    # Decoupled HTTP REST Clients
│       ├── trading_client.py       # Client for Trading Engine (:8081)
│       └── research_client.py      # Client for Strategy Lab (:8082)
├── tests/                          # 37 automated unit & degradation tests
└── docs/                           # Technical documentation
```

---

## 5. Running Tests & Continuous Integration

```bash
# Run all LastEdge App tests locally
python -m pytest tests/ -v
```
Current test suite status: **37 / 37 passed (100% Green)**.

### CI / Continuous Integration:
- **App & Control Plane CI**: Automated on every push and pull request via [GitHub Actions](.github/workflows/ci.yml).
- **Build Android APK**: Automated workflow compiling release APK on mobile changes via [GitHub Actions](.github/workflows/build-apk.yml).

---

## 6. Accessing the Dashboard

The dashboard can be accessed remotely via Tailscale:
- **Direct Tailscale IP**: `http://100.78.35.94:8080`
- **Tailscale Funnel (HTTPS)**: `https://vps-dev-eugenio.tail96b8f8.ts.net`
- **Default System PIN**: `1623`
