# LastEdge App — Graceful Degradation & Offline Modes

> **Module:** `LastEdge App`  
> **Source Files:** `services/dashboard_server.py`, `services/clients/`  

---

## 1. Degradation Scenarios Verified

| Scenario | Trading Engine (:8081) | Strategy Lab (:8082) | App Dashboard Behavior |
|:---:|:---:|:---:|---|
| **A** | ONLINE | ONLINE | Full metrics, open positions, and research experiments displayed. |
| **B** | ONLINE | OFFLINE | Trading fully active; Research tab displays `OFFLINE` badge with retry button. |
| **C** | OFFLINE | ONLINE | Research fully active; Trading tab displays `$0.00` balance and `OFFLINE` badge. |
| **D** | OFFLINE | OFFLINE | Standalone mode; zero crashes, static UI renders with clear system status. |
