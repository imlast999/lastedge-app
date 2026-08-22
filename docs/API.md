# LastEdge App — Proxy & Control API Reference

> **Module:** `LastEdge App`  
> **Server:** `services/dashboard_server.py`  
> **Port:** `8080`  

---

## 1. Endpoints Reference

### 1.1 App Unified Health Check
- **`GET /api/health`**
- **Description**: Probes both Trading Engine (:8081) and Strategy Lab (:8082) concurrently in parallel threads.
- **Response**:
```json
{
  "ok": true,
  "service": "LastEdge App & Dashboard",
  "status": "ONLINE",
  "trading_engine_online": true,
  "strategy_lab_online": true,
  "timestamp": "2026-08-22T18:00:00Z"
}
```

### 1.2 System Overview
- **`GET /api/status`**
- **Description**: Aggregates status from both Trading Engine and Strategy Lab.

### 1.3 Positions Proxy
- **`GET /api/positions`**
- **Description**: Proxies request to Trading Engine (`/api/trading/positions`). Returns empty list if offline.

### 1.4 Research Experiments Proxy
- **`GET /api/research/experiments`**
- **Description**: Proxies request to Strategy Lab (`/api/research/experiments`). Returns empty list if offline.
