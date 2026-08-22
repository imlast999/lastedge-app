# LastEdge App — Service Connections & HTTP Clients

> **Module:** `LastEdge App`  
> **Source Package:** `services/clients/`  

---

## 1. Decoupled Clients Architecture

App interacts with backend servers solely through `TradingClient` and `ResearchClient`:

```python
from services.clients.trading_client import get_trading_client
from services.clients.research_client import get_research_client

trading = get_trading_client()   # Connects to http://localhost:8081
research = get_research_client() # Connects to http://localhost:8082

if trading.is_online():
    positions = trading.get_positions()
```

---

## 2. Timeout & Fallback Policies

- Default request timeout is `2.0` seconds (configurable).
- Any network exception or timeout is caught and converted into a standard structured dictionary with `"offline": True` and safe default metrics.
