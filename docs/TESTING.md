# LastEdge App — Testing Guide

> **Module:** `LastEdge App`  
> **Framework:** `pytest`  
> **Current Status:** 11 / 11 Passed (100% Green)  

---

## 1. Running Test Suites

```powershell
# Run all App tests
python -m pytest tests/

# Run specific degradation test
python -m pytest tests/test_dashboard_degradation.py -v
```

---

## 2. Test Coverage Inventory

| Test Module | Tests | Focus Area |
|---|:---:|---|
| `tests/test_commands_refactored.py` | 2 | Discord CommandsService with mock Trading & Research clients |
| `tests/test_dashboard_degradation.py`| 1 | Graceful offline response of dashboard server endpoints |
| `tests/test_research_client.py` | 1 | ResearchClient HTTP requests and fallback dictionaries |
| `tests/test_telegram_adapter.py` | 6 | Telegram bot commands, parsing, and offline error handling |
| `tests/test_trading_client.py` | 1 | TradingClient HTTP methods and degradation formatting |
