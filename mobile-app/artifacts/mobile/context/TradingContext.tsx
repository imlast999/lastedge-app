import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { resolveApiConfig, getAppVersion } from "@/lib/apiConfig";
import { useSettings } from "@/context/SettingsContext";
import { sendLocalNotification } from "@/services/notifications";

// ── Public types (re-exported so routes / mocks can import them) ──────────────

export interface BotStatus {
  connected: boolean;
  uptime: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency?: string;
  circuitBreakerActive?: boolean;
  executionQuality?: {
    avgLatency: number;
    avgSlippage: number;
    successRate: number;
  };
}

export interface Signal {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  entry: number;
  takeProfit: number;
  stopLoss: number;
  status: "pending" | "active" | "closed" | "rejected" | "executed" | "expired";
  rrRatio: number;
  timestamp: string;
  lot: number;
  score?: number;
  confidence?: string;
  autoExecuted?: boolean;
  strategy?: string;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  open_price: number;
  current_price: number;
  sl: number;
  tp: number;
  profit: number;
  swap?: number;
  magic?: number;
  comment?: string;
  time?: string;
  spread?: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  openPrice: number;
  closePrice: number;
  pips: number;
  profit: number;
  closeReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_STOP" | "MANUAL" | "PARTIAL_TP" | "WEEKEND_GUARD";
  closedAt: string;
  lot: number;
  comment?: string;
  latencyMs?: number;
  slippagePips?: number;
}

export interface EquityPoint {
  time: number;
  value: number;
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface TradingContextValue {
  status: BotStatus | null;      // null while the first fetch is in flight
  signals: Signal[];
  positions: Position[];
  trades: Trade[];
  equityHistory: EquityPoint[];
  dailyPnL: number;
  winrate: number;
  openPositions: number;
  pendingSignals: number;
  currencySymbol: string;
  /** true during the first load or a manual refresh */
  loading: boolean;
  /** non-null when the API is unreachable */
  apiError: string | null;
  /** true when mock data is being shown instead of real data */
  usingMockData: boolean;
  acceptSignal: (id: string) => Promise<void>;
  rejectSignal: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  lastSyncAt: Date | null;
}

const TradingContext = createContext<TradingContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const { settings, shouldNotify, apiOverrides } = useSettings();

  const [status, setStatus] = useState<BotStatus | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equityHistory, setEquityHistory] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // References to detect transitions for notifications
  const prevStatus = useRef<BotStatus | null>(null);
  const prevSignals = useRef<Signal[]>([]);
  const prevPositions = useRef<Position[]>([]);
  const prevTrades = useRef<Trade[]>([]);
  const beNotifiedTickets = useRef<Set<number>>(new Set());
  const spreadSpikeTickets = useRef<Set<number>>(new Set());
  const lastWeekendPreWarnDate = useRef<string | null>(null);
  const lastDailyWrapDate = useRef<string | null>(null);
  const checkedAppUpdate = useRef<boolean>(false);

  // ── Network fetch helper (single-attempt, propagates errors to trigger mock fallback)

  const safeFetch = useCallback(
    async <T,>(path: string): Promise<T> => {
      const { url: apiUrl, token: apiSecret } = resolveApiConfig(apiOverrides);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      let res: Response;
      try {
        res = await fetch(`${apiUrl}${path}`, {
          signal: controller.signal,
          headers: apiSecret
            ? { Authorization: `Bearer ${apiSecret}`, "X-Api-Key": apiSecret }
            : {},
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
      return (await res.json()) as T;
    },
    [apiOverrides]
  );

  const fetchAllData = useCallback(async () => {
    const isEs = settings.language === "es";
    // If trading engine is disabled in ecosystem modules, do not poll or set errors!
    if (settings.ecosystemModules && !settings.ecosystemModules.tradingEngine) {
      setLoading(false);
      setApiError(null);
      return;
    }

    const { url: apiUrl } = resolveApiConfig(apiOverrides);
    if (!apiUrl) {
      setApiError("EXPO_PUBLIC_API_URL no configurada — especifica la URL en Ajustes");
      setLoading(false);
      return;
    }

    try {
      // 1. Status
      const statusData = await safeFetch<BotStatus>("/api/status");
      if (statusData) {
        // 5.1 Desconexión / Reconexión MT5
        if (prevStatus.current?.connected && !statusData.connected && shouldNotify("DISCONNECT")) {
          sendLocalNotification(
            "DISCONNECT",
            isEs ? "🚨 Desconexión de MT5 / VPS" : "🚨 MT5 / VPS Disconnected",
            isEs ? "El bot de trading ha perdido la conexión con el terminal MetaTrader 5." : "The trading bot lost connection to the MetaTrader 5 terminal."
          );
        } else if (prevStatus.current && !prevStatus.current.connected && statusData.connected && shouldNotify("DISCONNECT")) {
          sendLocalNotification(
            "DISCONNECT",
            isEs ? "🟢 Conexión MT5 Restaurada" : "🟢 MT5 Connection Restored",
            isEs ? "El enlace con MetaTrader 5 y VPS está de nuevo 100% operativo." : "The link to MetaTrader 5 and VPS is fully operational again."
          );
        }

        // 3.4 Activación de Circuit Breaker
        if (
          statusData.circuitBreakerActive &&
          !prevStatus.current?.circuitBreakerActive &&
          shouldNotify("CIRCUIT_BREAKER")
        ) {
          sendLocalNotification(
            "CIRCUIT_BREAKER",
            isEs ? "🚨 Circuit Breaker Activado" : "🚨 Circuit Breaker Activated",
            isEs ? "Trading pausado automáticamente por superar el límite de drawdown o racha de pérdidas." : "Trading automatically paused after exceeding max drawdown or loss streak limit."
          );
        }

        setStatus(statusData);
        prevStatus.current = statusData;
      }

      // 2. Signals
      const rawSignals = await safeFetch<any>("/api/signals");
      const signalsList: Signal[] = Array.isArray(rawSignals)
        ? rawSignals
        : Array.isArray(rawSignals?.signals)
        ? rawSignals.signals
        : [];
      if (signalsList.length > 0 || Array.isArray(rawSignals)) {
        signalsList.forEach((sig) => {
          const isNew = !prevSignals.current.find((s) => s.id === sig.id);
          if (isNew) {
            // 1.2 Señal Auto-Ejecutada (Tier HIGH/VERY_HIGH >= 0.67 o autoExecuted)
            if (sig.autoExecuted || (sig.score !== undefined && sig.score >= 0.67)) {
              if (shouldNotify("AUTO_SIGNAL")) {
                const pct = sig.score ? Math.round(sig.score * 100) : 85;
                sendLocalNotification(
                  "AUTO_SIGNAL",
                  isEs ? `⚡ Señal Auto-Ejecutada: ${sig.type} ${sig.symbol}` : `⚡ Auto-Executed Signal: ${sig.type} ${sig.symbol}`,
                  isEs ? `Score ${pct}% · Ejecutada automáticamente en MT5 (SL: ${sig.stopLoss} | TP: ${sig.takeProfit})` : `Score ${pct}% · Automatically executed on MT5 (SL: ${sig.stopLoss} | TP: ${sig.takeProfit})`
                );
              }
            } else if (sig.status === "pending") {
              // 1.1 Nueva Señal Discrecional (Modo Híbrido - TTL 10m)
              if (shouldNotify("DISCRETIONARY_SIGNAL")) {
                const pct = sig.score ? Math.round(sig.score * 100) : 60;
                sendLocalNotification(
                  "DISCRETIONARY_SIGNAL",
                  isEs ? `🎯 Señal Discrecional: ${sig.type} ${sig.symbol}` : `🎯 Discretionary Signal: ${sig.type} ${sig.symbol}`,
                  isEs ? `Score ${pct}% · Requiere confirmación manual antes de que expire el TTL (10m)` : `Score ${pct}% · Requires manual confirmation before 10m TTL expires`
                );
              }
            }
          }
        });

        // 1.3 Alerta de Tiempo Expirado (TTL 10m)
        prevSignals.current.forEach((prevSig) => {
          if (prevSig.status === "pending") {
            const currentMatch = signalsList.find((s) => s.id === prevSig.id);
            const isNowExpired =
              (currentMatch && currentMatch.status === "expired") ||
              (!currentMatch && Date.now() - new Date(prevSig.timestamp).getTime() > 600000);
            if (isNowExpired && shouldNotify("EXPIRED_SIGNAL")) {
              sendLocalNotification(
                "EXPIRED_SIGNAL",
                isEs ? `⏳ Señal Expirada: ${prevSig.symbol}` : `⏳ Expired Signal: ${prevSig.symbol}`,
                isEs ? `La señal ${prevSig.type} en ${prevSig.symbol} ha caducado por superar el límite de 10 minutos.` : `The ${prevSig.type} signal on ${prevSig.symbol} has expired (exceeded 10-minute limit).`
              );
            }
          }
        });

        setSignals(signalsList);
        prevSignals.current = signalsList;
      }

      // 2b. MT5 Positions
      const rawPositions = await safeFetch<any>("/api/positions");
      const positionsList: Position[] = Array.isArray(rawPositions)
        ? rawPositions
        : Array.isArray(rawPositions?.positions)
        ? rawPositions.positions
        : [];

      if (positionsList.length > 0 || Array.isArray(rawPositions)) {
        positionsList.forEach((pos) => {
          // 2.1 Trailing Stop Activado / Break-Even Asegurado (Riesgo Cero)
          const slVal = pos.sl;
          const openVal = pos.open_price;
          if (!beNotifiedTickets.current.has(pos.ticket) && slVal > 0 && openVal > 0) {
            const isAtBE =
              pos.comment?.toUpperCase().includes("BE") ||
              pos.comment?.toUpperCase().includes("BREAK") ||
              pos.comment?.toUpperCase().includes("TRAILING") ||
              (pos.type === "BUY" && slVal >= openVal - 0.0001) ||
              (pos.type === "SELL" && slVal <= openVal + 0.0001);

            const prevPos = prevPositions.current.find((p) => p.ticket === pos.ticket);
            const prevWasNotAtBE =
              !prevPos ||
              (pos.type === "BUY" ? prevPos.sl < openVal - 0.0001 : prevPos.sl > openVal + 0.0001);

            if (isAtBE && prevWasNotAtBE) {
              beNotifiedTickets.current.add(pos.ticket);
              if (shouldNotify("BREAK_EVEN")) {
                sendLocalNotification(
                  "BREAK_EVEN",
                  isEs ? `🛡️ Break-Even Asegurado: ${pos.symbol}` : `🛡️ Break-Even Secured: ${pos.symbol}`,
                  isEs ? `SL movido a precio de entrada (${openVal}) · Posición protegida a Riesgo Cero.` : `SL moved to entry price (${openVal}) · Position protected at Zero Risk.`
                );
              }
            }
          }

          // 5.2 Alerta de Spread Anormal (> 4.0 pips / 40 points)
          if (pos.spread && pos.spread > 40 && !spreadSpikeTickets.current.has(pos.ticket)) {
            spreadSpikeTickets.current.add(pos.ticket);
            if (shouldNotify("SPREAD_SPIKE")) {
              sendLocalNotification(
                "SPREAD_SPIKE",
                isEs ? `⚠️ Spread Anormal en ${pos.symbol}` : `⚠️ Abnormal Spread on ${pos.symbol}`,
                isEs ? `Spread elevado a ${(pos.spread / 10).toFixed(1)} pips. Nuevas órdenes bloqueadas preventivamente.` : `High spread at ${(pos.spread / 10).toFixed(1)} pips. New orders locked preventively.`
              );
            }
          }
        });

        // 3.1 Aviso Previo de Weekend Exposure Guard (Viernes 20:30 a 21:44 UTC)
        const now = new Date();
        const utcDay = now.getUTCDay(); // 5 = Viernes
        const utcHour = now.getUTCHours();
        const utcMin = now.getUTCMinutes();
        const todayDateStr = now.toISOString().split("T")[0];

        if (utcDay === 5 && ((utcHour === 20 && utcMin >= 30) || (utcHour === 21 && utcMin < 45))) {
          const nonBtc = positionsList.filter(
            (p) => !p.symbol.toUpperCase().includes("BTC") && !p.symbol.toUpperCase().includes("ETH")
          );
          if (nonBtc.length > 0 && lastWeekendPreWarnDate.current !== todayDateStr) {
            lastWeekendPreWarnDate.current = todayDateStr;
            if (shouldNotify("WEEKEND_GUARD_PRE")) {
              sendLocalNotification(
                "WEEKEND_GUARD_PRE",
                isEs ? "⚠️ Weekend Exposure Guard (Aviso Previo)" : "⚠️ Weekend Exposure Guard (Early Warning)",
                isEs ? `Quedan minutos para el cierre de mercado. ${nonBtc.length} posición(es) no-cripto serán cerradas a las 21:45 UTC.` : `Market close approaching. ${nonBtc.length} non-crypto position(s) will close at 21:45 UTC.`
              );
            }
          }
        }

        setPositions(positionsList);
        prevPositions.current = positionsList;
      }

      // 3. Trades
      const rawTrades = await safeFetch<any>("/api/trades");
      const tradesList: Trade[] = Array.isArray(rawTrades)
        ? rawTrades
        : Array.isArray(rawTrades?.trades)
        ? rawTrades.trades
        : [];
      if (tradesList.length > 0 || Array.isArray(rawTrades)) {
        tradesList.forEach((trade) => {
          if (!prevTrades.current.find((t) => t.id === trade.id)) {
            // 3.2 Confirmación Liquidación de Fin de Semana (Weekend Guard)
            if (
              trade.closeReason === "WEEKEND_GUARD" ||
              trade.comment?.toLowerCase().includes("weekend")
            ) {
              if (shouldNotify("WEEKEND_GUARD_EXEC")) {
                sendLocalNotification(
                  "WEEKEND_GUARD_EXEC",
                  isEs ? `🔒 Liquidación de Fin de Semana: ${trade.symbol}` : `🔒 Weekend Settlement: ${trade.symbol}`,
                  isEs ? `Operación cerrada preventivamente por Weekend Exposure Guard.` : `Position closed preventively by Weekend Exposure Guard.`
                );
              }
            }
            // 2.2 Take Profit Parcial Ejecutado (50% volumen)
            else if (
              trade.closeReason === "PARTIAL_TP" ||
              trade.comment?.toLowerCase().includes("partial") ||
              trade.comment?.toLowerCase().includes("tp1")
            ) {
              if (shouldNotify("PARTIAL_TP")) {
                const sign = trade.profit >= 0 ? "+" : "";
                sendLocalNotification(
                  "PARTIAL_TP",
                  isEs ? `💰 Take Profit Parcial: ${trade.symbol}` : `💰 Partial Take Profit: ${trade.symbol}`,
                  isEs ? `50% de volumen asegurado (${sign}${trade.profit.toFixed(2)}$). Resto protegido en Trailing Stop.` : `50% volume locked in (${sign}${trade.profit.toFixed(2)}$). Remaining position trailing.`
                );
              }
            }
            // 2.3 Cierre en Ganancia
            else if (trade.profit >= 0) {
              if (shouldNotify("TRADE_PROFIT")) {
                sendLocalNotification(
                  "TRADE_PROFIT",
                  isEs ? `🎯 Take Profit Alcanzado: ${trade.symbol}` : `🎯 Take Profit Hit: ${trade.symbol}`,
                  isEs ? `Operación cerrada con balance positivo (+${trade.profit.toFixed(2)}$).` : `Trade closed in profit (+${trade.profit.toFixed(2)}$).`
                );
              }
            }
            // 2.4 Cierre en Stop Loss
            else {
              if (shouldNotify("TRADE_LOSS")) {
                sendLocalNotification(
                  "TRADE_LOSS",
                  isEs ? `🛡️ Stop Loss Ejecutado: ${trade.symbol}` : `🛡️ Stop Loss Hit: ${trade.symbol}`,
                  isEs ? `Operación cerrada por límite de pérdida (-${Math.abs(trade.profit).toFixed(2)}$).` : `Trade closed at stop loss (-${Math.abs(trade.profit).toFixed(2)}$).`
                );
              }
            }
          }
        });
        setTrades(tradesList);
        prevTrades.current = tradesList;
      }

      // 6.1 Resumen Diario de Cierre de Sesión (Daily Wrap-Up a las 22:00 UTC)
      const nowWrap = new Date();
      const utcWrapHour = nowWrap.getUTCHours();
      const todayWrapStr = nowWrap.toISOString().split("T")[0];
      if (utcWrapHour >= 22 && lastDailyWrapDate.current !== todayWrapStr) {
        lastDailyWrapDate.current = todayWrapStr;
        if (shouldNotify("DAILY_WRAPUP")) {
          const todayTrades = tradesList.filter(
            (t) => t.closedAt && t.closedAt.startsWith(todayWrapStr)
          );
          const dayPnl = todayTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
          const winCount = todayTrades.filter((t) => t.profit > 0).length;
          const winRateStr =
            todayTrades.length > 0
              ? `${Math.round((winCount / todayTrades.length) * 100)}%`
              : "N/A";
          sendLocalNotification(
            "DAILY_WRAPUP",
            isEs ? "📊 Resumen de Sesión Diaria" : "📊 Daily Session Summary",
            isEs ? `PnL hoy: ${dayPnl >= 0 ? "+" : ""}${dayPnl.toFixed(2)}$ | ${todayTrades.length} trades cerrados | Winrate: ${winRateStr}` : `Today's PnL: ${dayPnl >= 0 ? "+" : ""}${dayPnl.toFixed(2)}$ | ${todayTrades.length} closed trades | Winrate: ${winRateStr}`
          );
        }
      }

      // 6.2 Nueva Versión de la App (APK Update Check 1 vez)
      if (!checkedAppUpdate.current) {
        checkedAppUpdate.current = true;
        fetch("https://api.github.com/repos/imlast999/lastedge-app/releases/latest", {
          headers: { Accept: "application/vnd.github.v3+json" },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((rel) => {
            if (rel && rel.tag_name) {
              const currentVer = `v${getAppVersion()}`;
              if (rel.tag_name !== currentVer && shouldNotify("APP_UPDATE")) {
                sendLocalNotification(
                  "APP_UPDATE",
                  isEs ? `🚀 Actualización Disponible (${rel.tag_name})` : `🚀 Update Available (${rel.tag_name})`,
                  isEs ? `Nueva versión de LastEdge App disponible. Toca aquí para descargar e instalar el nuevo APK.` : `New LastEdge App version available. Tap to download and install new APK.`,
                  { url: rel.html_url || "https://github.com/imlast999/lastedge-app/releases/latest" }
                );
              }
            }
          })
          .catch(() => {});
      }

      // 4. Equity history (optional — server may return 500 if table is empty)
      const rawEquity = await safeFetch<any>("/api/equityHistory").catch(
        () => null
      );
      const equityPoints: EquityPoint[] = Array.isArray(rawEquity)
        ? rawEquity
        : Array.isArray(rawEquity?.history)
        ? rawEquity.history
        : [];
      if (equityPoints.length > 0 || Array.isArray(rawEquity)) setEquityHistory(equityPoints);

      setApiError(null);
      setUsingMockData(false);
      setLastSyncAt(new Date());
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("Error polling trading bot API:", msg);
      setApiError(`Sin conexión con el servidor (${msg})`);
    } finally {
      setLoading(false);
    }
  }, [safeFetch, shouldNotify, apiOverrides, settings.ecosystemModules]);

  useEffect(() => {
    if (settings.ecosystemModules && !settings.ecosystemModules.tradingEngine) {
      setLoading(false);
      setApiError(null);
      return;
    }
    fetchAllData();
    if (!settings.autoRefresh) return;
    const interval = setInterval(fetchAllData, settings.pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchAllData, settings.autoRefresh, settings.pollIntervalMs, settings.ecosystemModules?.tradingEngine, apiOverrides.url, apiOverrides.token]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const acceptSignal = useCallback(
    async (id: string) => {
      const { url: apiUrl, token: apiSecret } = resolveApiConfig(apiOverrides);
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/api/signals/${id}/accept`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiSecret
              ? { Authorization: `Bearer ${apiSecret}`, "X-Api-Key": apiSecret }
              : {}),
          },
        });
        const data = await res.json();
        if (data.ok) {
          await fetchAllData();
        } else {
          throw new Error(data.error ?? "Failed to accept signal");
        }
      } catch (e) {
        console.warn("Error accepting signal:", e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [fetchAllData, apiOverrides]
  );

  const rejectSignal = useCallback(
    async (id: string) => {
      const { url: apiUrl, token: apiSecret } = resolveApiConfig(apiOverrides);
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/api/signals/${id}/reject`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiSecret
              ? { Authorization: `Bearer ${apiSecret}`, "X-Api-Key": apiSecret }
              : {}),
          },
        });
        const data = await res.json();
        if (data.ok) {
          await fetchAllData();
        } else {
          throw new Error(data.error ?? "Failed to reject signal");
        }
      } catch (e) {
        console.warn("Error rejecting signal:", e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [fetchAllData, apiOverrides]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchAllData();
  }, [fetchAllData]);

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const dailyPnL = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
  const winrate =
    trades.length > 0
      ? (trades.filter((t) => t.profit > 0).length / trades.length) * 100
      : 0;
  const openPositions = positions.length;
  const pendingSignals = signals.filter((s) => s.status === "pending").length;
  const currencySymbol = status?.currency ? status.currency + " " : "$";

  const value = {
    status,
    signals,
    positions,
    trades,
    equityHistory,
    dailyPnL,
    winrate,
    openPositions,
    pendingSignals,
    currencySymbol,
    loading,
    apiError,
    usingMockData,
    acceptSignal,
    rejectSignal,
    refresh,
    lastSyncAt,
  };

  return (
    <TradingContext.Provider value={value}>{children}</TradingContext.Provider>
  );
}

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error("useTrading must be used inside TradingProvider");
  return ctx;
}
