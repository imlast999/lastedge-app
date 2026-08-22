# LastEdge Mobile

App móvil nativa (Android/iOS) para monitorizar y controlar remotamente el bot de trading algorítmico MT5 en Python, sustituyendo la necesidad de usar Discord.

## Stack

- **pnpm workspaces**, Node.js 24, TypeScript 5.9
- **Frontend:** React Native con Expo (Expo Router)
- **Estilos:** Dark Theme glassmorphism, NativeWind/Tailwind, `@expo/vector-icons`
- **API:** Express 5 (Node.js)
- **Base de datos:** PostgreSQL + Drizzle ORM
- **Validación:** Zod (`zod/v4`), `drizzle-zod`
- **Codegen de API:** Orval (desde spec OpenAPI)
- **Build:** esbuild (bundle CJS)

## Estructura del workspace

```
artifacts/
  api-server/     — Servidor Express 5 (API REST)
  mobile/         — App React Native / Expo
  mockup-sandbox/ — Sandbox de UI con Vite + React (web)
lib/
  api-spec/       — Spec OpenAPI + config Orval
  api-zod/        — Schemas Zod generados (contratos de API)
  api-client-react/ — Hooks React Query generados
  db/             — Schema Drizzle ORM + migraciones
scripts/          — Scripts de utilidad del workspace
```

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL |

## Comandos principales

```bash
# Instalar dependencias (requiere pnpm)
pnpm install --ignore-scripts

# Servidor de API (puerto 5000)
pnpm --filter @workspace/api-server run dev

# App móvil Expo
pnpm --filter @workspace/mobile run dev

# Sandbox UI web
pnpm --filter @workspace/mockup-sandbox run dev

# Typecheck completo (todos los paquetes)
pnpm run typecheck

# Build completo (typecheck + build)
pnpm run build

# Regenerar hooks y schemas Zod desde el spec OpenAPI
pnpm --filter @workspace/api-spec run codegen

# Aplicar cambios de schema a la BD (solo dev)
pnpm --filter @workspace/db run push
```

## Compilar APK Android

1. Instalar EAS CLI: `npm install -g eas-cli`
2. Autenticarse: `eas login`
3. Compilar APK de preview (distribución interna):
   ```bash
   cd artifacts/mobile
   eas build --profile preview --platform android
   ```
4. Para build de producción:
   ```bash
   eas build --profile production --platform android
   ```

## Endpoints de la API del bot MT5

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/status` | GET | Estado MT5, uptime, balance de cuenta |
| `/api/signals` | GET | Historial de señales y posiciones abiertas |
| `/api/signals/{id}/action` | POST | Aceptar o rechazar señales pendientes |

La app hace polling cada 5 segundos (o WebSocket) para actualización de equidad en tiempo real.

## Notificaciones Push

La app maneja 3 categorías de notificaciones vía Expo Push Service:

- 🚨 **Errores críticos** — Desconexión MT5, error de margen (sonido fuerte)
- 🔔 **Nuevas señales** — Señal detectada que requiere aprobación (abre pantalla de Señales)
- 💰 **Cierres de operación** — Take Profit / Stop Loss alcanzado

## Diseño UI

- Fondo estricto Dark Theme (`#09090b` / `#121212`)
- Verde neón `#4ade80` para ganancias y órdenes BUY
- Rojo coral `#f87171` para pérdidas y órdenes SELL
- Fuentes monospace para valores numéricos
- Estética glassmorphism orientada a datos financieros
