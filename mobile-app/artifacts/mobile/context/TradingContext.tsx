import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { resolveApiConfig } from "@/lib/apiConfig";
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
}

export interface Trade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  openPrice: number;
  closePrice: number;
  pips: number;
  profit: number;
  closeReason: "TAKE_PROFIT" | "STOP_LOSS" | "MANUAL";
  closedAt: string;
  lot: number;
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
  const prevTrades = useRef<Trade[]>([]);

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
        if (
          prevStatus.current?.connected &&
          !statusData.connected &&
          shouldNotify("CRITICAL_ERROR")
        ) {
          sendLocalNotification(
            "CRITICAL_ERROR",
            "🚨 Desconexión de MT5",
            "El bot de trading ha perdido la conexión con el terminal MetaTrader 5."
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
          if (!prevSignals.current.find((s) => s.id === sig.id) && shouldNotify("NEW_SIGNAL")) {
            sendLocalNotification(
              "NEW_SIGNAL",
              `🎯 Nueva señal ${sig.type} ${sig.symbol}`,
              `Entrada: ${sig.entry} | TP: ${sig.takeProfit} | SL: ${sig.stopLoss}`
            );
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
      setPositions(positionsList);

      // 3. Trades
      const rawTrades = await safeFetch<any>("/api/trades");
      const tradesList: Trade[] = Array.isArray(rawTrades)
        ? rawTrades
        : Array.isArray(rawTrades?.trades)
        ? rawTrades.trades
        : [];
      if (tradesList.length > 0 || Array.isArray(rawTrades)) {
        tradesList.forEach((trade) => {
          if (!prevTrades.current.find((t) => t.id === trade.id) && shouldNotify("TRADE_CLOSE")) {
            const sign = trade.profit >= 0 ? "+" : "";
            sendLocalNotification(
              "TRADE_CLOSE",
              `✅ Operación cerrada en ${trade.symbol}`,
              `${trade.closeReason === "TAKE_PROFIT" ? "Take Profit 🎯" : "Stop Loss 🛡️"} (${sign}${trade.profit})`
            );
          }
        });
        setTrades(tradesList);
        prevTrades.current = tradesList;
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
