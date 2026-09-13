# LastEdge App — Service Connections & Graceful Degradation

> **Module:** `LastEdge App`  
> **Source Package:** `services/clients/`, `services/dashboard_server.py`  
> **Status:** Production Standard  

---

## 1. Decoupled Service Clients Architecture

LastEdge App communicates with backend systems exclusively over isolated HTTP REST clients:

```text
[LastEdge App] ──┬──► [TradingClient]   ──► http://localhost:8081 (Trading Engine)
                 └──► [ResearchClient]  ──► http://localhost:8082 (Strategy Lab)
```

```python
from services.clients.trading_client import get_trading_client
from services.clients.research_client import get_research_client

trading = get_trading_client()
research = get_research_client()

if trading.is_online():
    positions = trading.get_positions()
```

---

## 2. Timeout & Fallback Policies

- **Timeout:** Default request timeout is `2.0` seconds (non-blocking).
- **Graceful Error Handling:** Network exceptions and timeouts return structured fallback dictionaries (`"offline": True`) without throwing uncaught exceptions.

---

## 3. Degradation Matrix (All 4 Scenarios Verified)

| Scenario | Trading Engine (:8081) | Strategy Lab (:8082) | App Dashboard Behavior |
|:---:|:---:|:---:|---|
| **A** | ONLINE | ONLINE | Full metrics, open positions, and research experiments displayed seamlessly. |
| **B** | ONLINE | OFFLINE | Trading fully active; Research tab displays `OFFLINE` badge with retry action. |
| **C** | OFFLINE | ONLINE | Research fully active; Trading tab displays `$0.00` balance and `OFFLINE` badge. |
| **D** | OFFLINE | OFFLINE | Standalone mode; zero crashes, static UI renders with clear system offline notice. |
