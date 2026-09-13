# LastEdge App — Testing & CI/CD Specification

> **Module:** `LastEdge App`  
> **Framework:** `pytest`  
> **Workflow:** `.github/workflows/ci.yml`  
> **Test Status:** 11 / 11 Passed (100% Green)  

---

## 1. Running Automated Tests

```powershell
# Run all 11 LastEdge App test suites
python -m pytest tests/

# Run with verbose output
python -m pytest tests/ -v

# Run degradation tests specifically
python -m pytest tests/test_dashboard_degradation.py -v
```

---

## 2. Test Suite Inventory

| Test Module | Tests | Description |
|---|:---:|---|
| `tests/test_commands_refactored.py` | 2 | Discord command factory and slash command setups |
| `tests/test_dashboard_degradation.py`| 1 | Dashboard server startup & all 4 offline backend scenarios |
| `tests/test_research_client.py` | 1 | Graceful offline error handling for Strategy Lab API |
| `tests/test_telegram_adapter.py` | 6 | Telegram bot commands (`/status`, `/equity`, `/risk`, etc.) & broadcast |
| `tests/test_trading_client.py` | 1 | Graceful offline error handling for Trading Engine API |
| **Total** | **11** | **100% Automated Test Coverage** |

---

## 3. GitHub Actions Continuous Integration (`.github/workflows/ci.yml`)

- **Workflow:** Automated linting and test runs across Python `3.10`, `3.11`, `3.12`, `3.13` on Ubuntu and Windows.
- **Independence:** Mocks all external Discord/Telegram network sockets and backend HTTP calls to guarantee 100% offline determinism.
