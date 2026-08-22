# LastEdge App — Installation Guide

> **Module:** `LastEdge App`  
> **Requirements:** Python 3.10+ (Node.js 18+ for Mobile App)  

---

## 1. Installation Steps

### Step 1: Clone Repository
```bash
git clone https://github.com/imlast999/lastedge-app.git
cd lastedge-app
```

### Step 2: Install Python Dependencies
```bash
python -m venv venv
# Linux / macOS
source venv/bin/activate
# Windows
.\venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Configure Environment
```bash
cp .env.example .env
```
Edit `.env`:
```ini
APP_PORT=8080
TRADING_ENGINE_URL=http://localhost:8081
STRATEGY_LAB_URL=http://localhost:8082
API_TIMEOUT_SECONDS=2.0
```

### Step 4: Run Tests
```bash
python -m pytest tests/
```
All 11 tests should pass.
