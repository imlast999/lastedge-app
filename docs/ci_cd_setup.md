# LastEdge App — CI/CD Pipeline Specification

> **Module:** `LastEdge App`  
> **Workflow:** `.github/workflows/ci.yml`  
> **Status:** CI ENABLED | CD NOT ENABLED  

---

## 1. Workflow Overview

The Continuous Integration (CI) pipeline validates the Web Dashboard server, REST API clients (`TradingClient`, `ResearchClient`), Discord commands, Telegram bot adapter, and graceful degradation mechanics on every push and pull request to `main`.

- **CI Status Badge**: `[![App & Control Plane CI](https://github.com/imlast999/lastedge-app/actions/workflows/ci.yml/badge.svg)](https://github.com/imlast999/lastedge-app/actions/workflows/ci.yml)`

---

## 2. Triggers & Permissions

- **Triggers**:
  - `push` to `main`
  - `pull_request` to `main`
- **Permissions**:
  - `contents: read` (Strict least-privilege security)
- **Timeout**: 10 minutes maximum execution limit.

---

## 3. Pipeline Stages & Checks

1. **Environment Setup**:
   - Runner: `ubuntu-latest`
   - Python matrix: `3.10`, `3.11`, `3.12` via `actions/setup-python@v5` with pip caching.
2. **Dependency Installation**:
   - `pip install -r requirements.txt` (`requests`, `urllib3`, `discord.py`, `python-telegram-bot`, `pytest`).
3. **Static Syntax Validation**:
   - `python -m compileall services tests`
4. **Client & Adapter Verification**:
   - Verifies `TradingClient`, `ResearchClient`, Telegram, and Discord adapters import cleanly.
5. **Automated Test Suite**:
   - `pytest tests/ -v --tb=short` (11/11 unit, integration, and degraded mode tests).

---

## 4. External Dependencies & Secrets

- **No Active Backends Required**: Clients test graceful fallback and offline handling.
- **No Telegram/Discord Tokens Required**: Mocks and unit harnesses validate commands offline.
- **No Secrets Required**: Zero private tokens or passwords are required in CI.

---

## 5. Local / CI Parity

```bash
# 1. Compile check
python -m compileall services tests

# 2. Client verification check
python -c "from services.clients.trading_client import TradingClient; from services.clients.research_client import ResearchClient; print('OK')"

# 3. Run test suite
pytest tests/ -v
```

---

## 6. Continuous Deployment (CD)

> [!NOTE]
> Automatic Deployment is **NOT ENABLED**. Mobile compilation (APK/IPA) and production web serving are managed manually.
