<div align="center">

<img src="branding/LastEdge_Logo.png" alt="LastEdge App Logo" width="160">

# LastEdge App

[![App & Control Plane CI](https://github.com/imlast999/lastedge-app/actions/workflows/ci.yml/badge.svg)](https://github.com/imlast999/lastedge-app/actions/workflows/ci.yml)

> **Repository:** [`imlast999/lastedge-app`](https://github.com/imlast999/lastedge-app)  
> **Role:** Unified Control Center, Web Dashboard, Mobile Application & Bot Adapters  
> **Status:** Production Ready  
> **Tests:** 11 / 11 Passed (100% Green)  

</div>

---

## 1. Overview

**LastEdge App** is the control plane and user-facing monitoring suite for the LastEdge quantitative platform. It provides real-time visibility and control into live trading positions, account metrics, risk telemetry, research experiments, and messaging alerts.

### Key Capabilities:
- **Web Dashboard**: Modern, responsive dark-mode dashboard running on port `8080` (`services/dashboard_server.py`).
- **Mobile Application**: Cross-platform React Native / Expo application for Android and iOS (`mobile-app/`).
- **Decoupled Architecture**: Communicates exclusively via HTTP REST APIs with `Trading Engine` (:8081) and `Strategy Lab` (:8082).
- **Graceful Degradation**: 100% crash-proof operation; displays clear status badges and offline fallbacks when backend engines are temporarily offline.
- **Messaging Adapters**: Decoupled Discord Slash command adapter (`services/commands_refactored.py`) and Telegram Bot polling adapter (`services/telegram_adapter.py`).

---

## 2. Ecosystem & Sister Repositories

LastEdge App sits at the presentation layer of the LastEdge ecosystem, connecting traders and researchers with the underlying engines:

| Repository | Role | Integration Point |
| :--- | :--- | :--- |
| ⚡ [**LastEdge Trading Engine**](https://github.com/imlast999/lastedge-trading-engine) | MT5 Execution & Risk Engine v2 | **Live Execution Telemetry**: App connects via [`services/clients/trading_client.py`](services/clients/trading_client.py) to `http://localhost:8081` to display active positions, daily drawdown, trailing stops, and account equity. |
| 🔬 [**LastEdge Strategy Lab**](https://github.com/imlast999/lastedge-strategy-lab) | Quantitative Research & Validation | **Research Telemetry & Control**: App connects via [`services/clients/research_client.py`](services/clients/research_client.py) to `http://localhost:8082` to display backtest metrics, candidate statuses, and trigger research pipeline jobs. |

If either backend engine is offline, LastEdge App continues serving user requests smoothly using cached telemetry and graceful fallback states.

---

## 3. Architecture & Directory Structure

```text
LastEdge App/
├── dashboard/                      # Web Dashboard frontend (HTML, CSS, JS)
├── mobile-app/                     # React Native / Expo mobile application
├── services/
│   ├── dashboard_server.py         # Standalone Web Dashboard HTTP server (:8080)
│   ├── telegram_adapter.py         # Decoupled Telegram Bot adapter
│   ├── commands_refactored.py      # Decoupled Discord Slash command adapter
│   ├── notification_dispatcher.py  # Central notification router
│   ├── charts.py                   # Chart generation helpers
│   ├── i18n.py                     # Multi-language support (ES, EN)
│   └── clients/                    # Decoupled HTTP REST Clients
│       ├── trading_client.py       # Client for Trading Engine (:8081)
│       └── research_client.py      # Client for Strategy Lab (:8082)
├── tests/                          # 11 automated unit & degradation tests
└── docs/                           # Technical documentation
```

---

## 4. Quick Start & Installation

### Requirements:
- Python 3.10+ (For Web Dashboard and Bot Adapters)
- Node.js 18+ & PNPM (Optional, for Mobile App development)

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

---

## 5. Running Tests & Continuous Integration

```bash
# Run all App tests locally
python -m pytest tests/ -v
```
Current test suite status: **11 / 11 passed (100% Green)**.

### CI / Continuous Integration:
- **Pipeline**: Automated on every push and pull request to `main` via [GitHub Actions](.github/workflows/ci.yml).
- **Environment**: Multi-Python matrix (3.10, 3.11, 3.12, 3.13) on Ubuntu and Windows.
- **Degraded Mode & Fallbacks**: Tests verify that App and clients never crash when backends are offline.

---

## 6. Documentation Index

For detailed guides, refer to [`docs/`](docs/):

- 🏛️ [**Architecture**](docs/ARCHITECTURE.md): Control plane design, REST clients, and adapters.
- ⚙️ [**Installation**](docs/INSTALLATION.md): Setup for Dashboard, Discord, Telegram, and Mobile.
- 🔧 [**Configuration**](docs/CONFIGURATION.md): `.env` parameters, backend URLs, and API tokens.
- 💻 [**Web Dashboard**](docs/DASHBOARD.md): UI layout, real-time polling, and static asset serving.
- 🌐 [**REST API**](docs/API.md): App proxy endpoints and health check schemas on port `8080`.
- 🤖 [**Bots Integration**](docs/BOTS.md): Discord slash commands, Telegram polling adapter, and notifications.
- 📱 [**Mobile App**](docs/MOBILE.md): React Native, Expo, build scripts, and tabs architecture.
- 🔌 [**Service Connections & Degradation**](docs/SERVICE_CONNECTIONS.md): HTTP communication with backend engines and offline handling.
- 🧪 [**Testing & CI/CD**](docs/TESTING.md): Unit tests, degradation matrix, and GitHub Actions specification.
