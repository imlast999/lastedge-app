# LastEdge App

Control center, Web Dashboard, Mobile App, Discord & Telegram bots for LastEdge.

## Overview
- **Web Dashboard**: Decoupled HTTP interface on port `8080` with dark mode telemetry.
- **Mobile App**: React Native / Expo application for real-time monitoring.
- **Messaging Adapters**: Decoupled Telegram and Discord bot adapters.
- **Resilient Clients**: `TradingClient` and `ResearchClient` with automatic offline graceful degradation.

## Quick Start
```bash
pip install -r requirements.txt
cp .env.example .env
python -m services.dashboard_server 8080
```
