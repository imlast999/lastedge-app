# LastEdge Mobile

Native mobile client (Android / iOS) for remote monitoring, telemetry, and execution control of the LastEdge MetaTrader 5 algorithmic trading engine in Python.

## Technology Stack

- **pnpm workspaces**, Node.js 24, TypeScript 5.9
- **Frontend:** React Native with Expo (Expo Router)
- **Styling:** Dark Theme glassmorphism, NativeWind / Tailwind CSS, `@expo/vector-icons`
- **API:** Express 5 (Node.js)
- **Database:** PostgreSQL + Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI specification)
- **Build:** esbuild (CommonJS bundle)

## Workspace Architecture

```
artifacts/
  api-server/     — Express 5 REST API gateway
  mobile/         — React Native / Expo mobile application
  mockup-sandbox/ — UI Sandbox with Vite + React (Web preview)
lib/
  api-spec/       — OpenAPI specification + Orval configuration
  api-zod/        — Generated Zod schemas (API contracts)
  api-client-react/ — Generated React Query hooks
  db/             — Drizzle ORM schema + database migrations
scripts/          — Workspace maintenance utilities
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |

## Primary Commands

```bash
# Install dependencies (requires pnpm)
pnpm install --ignore-scripts

# Launch API server (Port 5000)
pnpm --filter @workspace/api-server run dev

# Launch Expo mobile application
pnpm --filter @workspace/mobile run dev

# Launch Web UI sandbox
pnpm --filter @workspace/mockup-sandbox run dev

# Comprehensive typecheck (all packages)
pnpm run typecheck

# Full production build (typecheck + bundle)
pnpm run build

# Regenerate hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Apply schema migrations to database (development only)
pnpm --filter @workspace/db run push
```

## Android APK Compilation

1. Install EAS CLI: `npm install -g eas-cli`
2. Authenticate: `eas login`
3. Compile preview APK (internal testing distribution):
   ```bash
   cd artifacts/mobile
   eas build --profile preview --platform android
   ```
4. Production release build:
   ```bash
   eas build --profile production --platform android
   ```

## Bot API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | GET | MT5 terminal status, uptime, account balance & equity |
| `/api/signals` | GET | Signal history and active open positions |
| `/api/signals/{id}/action` | POST | Approve or discard pending proposed signals |

The client polls every 5 seconds (or via WebSocket) for real-time equity and P&L updates.

## Push Notifications

The application handles 3 notification tiers via Expo Push Service:

- 🚨 **Critical Alerts** — MT5 terminal disconnection, margin warnings (high-priority sound)
- 🔔 **New Trading Signals** — Proposed trade requiring manual approval (opens Signals screen)
- 💰 **Execution Exits** — Take Profit / Stop Loss / Trailing hit confirmation

## UI & Design System

- Strict Dark Theme canvas (`#09090b` / `#121212`)
- Emerald Green `#4ade80` for profits and BUY executions
- Coral Red `#f87171` for drawdowns and SELL executions
- Monospace font styling for quantitative numeric readouts
- High-contrast glassmorphism aesthetic tailored for financial telemetry
