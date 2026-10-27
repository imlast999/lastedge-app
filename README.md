<div align="center">

<img src="branding/LastEdge_Logo.png" alt="LastEdge App Logo" width="160">

# LastEdge App

[![App & Control Plane CI](https://github.com/imlast999/lastedge-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/imlast999/lastedge-app/actions/workflows/ci.yml)
[![Build Android APK](https://github.com/imlast999/lastedge-app/actions/workflows/build-apk.yml/badge.svg)](https://github.com/imlast999/lastedge-app/actions/workflows/build-apk.yml)
[![Download APK](https://img.shields.io/badge/Download%20APK-v1.1.41-brightgreen?logo=android)](https://github.com/imlast999/lastedge-app/releases/download/v1.1.41/LastEdge-v1.1.41.apk)
[![Tests](https://img.shields.io/badge/Tests-37%2F37%20Passed-success)](https://github.com/imlast999/lastedge-app)

> **Repository:** [`imlast999/lastedge-app`](https://github.com/imlast999/lastedge-app)  
> **Role:** Unified Control Center, Web Dashboard, Mobile Application & Bot Adapters  
> **Status:** Production Ready  
> **Tests:** 37 / 37 Passed (100% Green)  

</div>

---

> [!NOTE]
> **Part of the [LastEdge](https://github.com/imlast999/LastEdge) Ecosystem**  
> This repository is the control and presentation layer of the **LastEdge** quantitative trading platform. While it can run independently (using built-in graceful degradation and cached states), **we strongly recommend running the complete LastEdge suite** via the main orchestrator repository ([`imlast999/LastEdge`](https://github.com/imlast999/LastEdge)) using its automated clone script (`setup.bat` / `clone_repos.bat`) to unlock real-time live trading feeds, interactive research controls, and instant bot alerts.

---

## 1. Overview

**LastEdge App** is the control plane and user-facing monitoring suite for the LastEdge quantitative platform. It provides real-time visibility and control into live trading positions, account metrics, risk telemetry, research experiments, and messaging alerts.

### Key Capabilities:
- **Web Dashboard (Bento Grid 2.0)**: Modern, responsive glassmorphism dashboard running on port `8080` (`services/dashboard_server.py`) with real-time Chart.js equity tracking and educational financial tooltips.
- **Mobile Native Application (React Native / Expo 54)**: Production-ready Android & iOS client featuring biometric authentication, 1-tap MT5 signal approval, live 1-second countdown tickers, and a 2-subtab Strategy Lab.
- **Direct APK Release (`v1.1.41`)**: Instant downloadable release build signed with production keystore: [**`LastEdge-v1.1.41.apk`**](https://github.com/imlast999/lastedge-app/releases/download/v1.1.41/LastEdge-v1.1.41.apk).
- **Decoupled Architecture**: Communicates exclusively via HTTP REST APIs with `Trading Engine` (:8081) and `Strategy Lab` (:8082).
- **Graceful Degradation**: 100% crash-proof operation; displays clear status badges and offline fallbacks when backend engines are temporarily offline.
- **Messaging Adapters & Control Center**: Decoupled Discord Slash command adapter (`services/commands_refactored.py`) and Telegram Bot polling adapter (`services/telegram_adapter.py`) with native command autocomplete (`setMyCommands`) in English and Spanish.
- **Visual Technical Chart Engine**: TradingView-styled dark mode (`#090d16`) chart generator (`services/chart_helper.py`, `services/charts.py`) with 80 H1 candles, dynamic Y-axis scaling (+8% padding ensuring Entry, SL & TP are in frame), EMA50/EMA200, and shaded Risk/Reward zone boxes.
- **Deep Linking & On-Demand Position Charts**: Direct bot triggers (`t.me/LastEdgeBot?start=chart_{ticket}`) and `/chart_{ticket}` commands for instant visual chart generation from open MT5 positions.
- **Web Dashboard Chart Modals**: Interactive `📊 Chart` modal viewer directly inside the Bento Grid positions table powered by `/api/positions/{ticket}/chart`.

---

## 2. Ecosystem & Sister Repositories

LastEdge App sits at the presentation layer of the LastEdge ecosystem, connecting traders and researchers with the underlying engines:

| Repository | Role | Integration Point |
| :--- | :--- | :--- |
| 🧭 [**LastEdge (Main Suite)**](https://github.com/imlast999/LastEdge) | Ecosystem Orchestrator & CLI | **Unified Workspace**: Automated setup script (`setup.bat` / `clone_repos.bat`) to synchronize and run the complete three-repository trading suite. |
| ⚡ [**LastEdge Trading Engine**](https://github.com/imlast999/lastedge-trading-engine) | MT5 Execution & Risk Engine v2 | **Live Execution Telemetry**: App connects via [`services/clients/trading_client.py`](services/clients/trading_client.py) to `http://localhost:8081` to display active positions, daily drawdown, trailing stops, broker quality metrics, and approve trade execution. |
| 🧪 [**LastEdge Strategy Lab**](https://github.com/imlast999/lastedge-strategy-lab) | Quantitative Research & Validation | **Research Telemetry & Control**: App connects via [`services/clients/research_client.py`](services/clients/research_client.py) to `http://localhost:8082` to display backtest metrics, candidate statuses, and trigger research pipeline jobs. |

If either backend engine is offline, LastEdge App continues serving user requests smoothly using cached telemetry and graceful fallback states.

---

## 3. Architecture & Directory Structure

```text
LastEdge App/
├── build_apk.bat                   # Windows CLI launcher for Android APK compilation
├── build_apk.py                    # Interactive Python build, diagnostic & ADB deployer
├── dashboard/                      # Web Dashboard frontend (HTML, CSS, JS, Chart.js)
├── mobile-app/                     # React Native / Expo mobile application
│   └── artifacts/mobile/
│       ├── app/                    # Expo Router tabs (index, trades, lab, settings)
│       ├── components/             # Reusable UI components & PedagogicalPillarsSuite
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

## 4. Quick Start & Installation

### Requirements:
- Python 3.10+ (For Web Dashboard and Bot Adapters)
- Node.js 20+ & PNPM 10 (Optional, for Mobile App development)

### Step 1: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Configure Environment
```bash
cp .env.example .env
```
Default `.env` configuration:
```ini
APP_PORT=8080
TRADING_ENGINE_URL=http://localhost:8081
STRATEGY_LAB_URL=http://localhost:8082
API_TIMEOUT_SECONDS=2.0
```

### Step 3: Start Web Dashboard Server
```bash
python -m services.dashboard_server 8080
```
Open your browser at `http://localhost:8080` to access the live dashboard.

### Step 4: Run Mobile App (Local Dev) or Build APK
```bash
cd mobile-app
pnpm install
npx expo start
```
Or download the pre-compiled APK directly: [**`LastEdge-v1.1.41.apk`**](https://github.com/imlast999/lastedge-app/releases/download/v1.1.41/LastEdge-v1.1.41.apk).

---

## 5. Running Tests & Continuous Integration

```bash
# Run all App tests locally
python -m pytest tests/ -v
```
Current test suite status: **37 / 37 passed (100% Green)**.

### CI / Continuous Integration:
- **App & Control Plane CI**: Automated on every push and pull request via [GitHub Actions](.github/workflows/ci.yml).
- **Build Android APK**: Automated workflow [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml) compiles and signs production `.apk` releases on version tags.
- **Degraded Mode & Fallbacks**: Tests verify that App and clients never crash when backends are offline.

---

## 6. Documentation Index

For detailed guides, refer to [`docs/`](docs/):

- 📐 [**Architecture**](docs/ARCHITECTURE.md): Control plane design, REST clients, and adapters.
- 🛠️ [**Installation**](docs/INSTALLATION.md): Setup for Dashboard, Discord, Telegram, and Mobile.
- ⚙️ [**Configuration**](docs/CONFIGURATION.md): `.env` parameters, backend URLs, and API tokens.
- 📊 [**Web Dashboard**](docs/DASHBOARD.md): UI layout, real-time polling, and static asset serving.
- 🔌 [**REST API**](docs/API.md): App proxy endpoints and health check schemas on port `8080`.
- 🤖 [**Bots Integration**](docs/BOTS.md): Discord slash commands, Telegram polling adapter, and notifications.
- 📱 [**Mobile App**](docs/MOBILE.md): React Native, Expo, build scripts, and tabs architecture.
- 🔄 [**Service Connections & Degradation**](docs/SERVICE_CONNECTIONS.md): HTTP communication with backend engines and offline handling.
- 🧪 [**Testing & CI/CD**](docs/TESTING.md): Unit tests, degradation matrix, and GitHub Actions specification.
