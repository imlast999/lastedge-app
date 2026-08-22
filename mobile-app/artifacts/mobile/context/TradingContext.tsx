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
  status: "pending" | "active" | "closed" | "rejected";
  rrRatio: number;
  timestamp: string;
  lot: number;
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
  trades: Trade[];
  equityHistory: EquityPoint[];
  dailyPnL: number;
  winrate: number;
  openPositions: number;
  pendingSignals: number;
  /** true during the first load or a manual refresh */
  loading: boolean;
  /** non-null when the API is unreachable */
  apiError: string | null;
  /** true when mock data is being shown instead of real data */
  usingMockData: boolean;
  acceptSignal: (id: string) => Promise<void>;
  rejectSignal: (id: string) => Promise<void>;
  refresh: () => void;
  lastSyncAt: Date | null;
}

// ── API URL ───────────────────────────────────────────────────────────────────

const TradingContext = createContext<TradingContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const { settings, shouldNotify, apiOverrides } = useSettings();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equityHistory, setEquityHistory] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const prevStatus = useRef<BotStatus | null>(null);
  const prevSignals = useRef<Signal[]>([]);
  const prevTrades = useRef<Trade[]>([]);

  // Derived stats
  const dailyPnL = trades
    .filter((t) => new Date(t.closedAt).getTime() > Date.now() - 86400000)
    .reduce((sum, t) => sum + t.profit, 0);
  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.profit > 0).length;
  const winrate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;
  const openPositions = signals.filter((s) => s.status === "active").length;
  const pendingSignals = signals.filter((s) => s.status === "pending").length;

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const safeFetch = useCallback(
    async <T,>(path: string): Promise<T | null> => {
      const { url: apiUrl, token: apiSecret } = resolveApiConfig(apiOverrides);
      if (!apiUrl) return null;
      const res = await fetch(`${apiUrl}${path}`, {
        headers: apiSecret
          ? {
              Authorization: `Bearer ${apiSecret}`,
              "X-Api-Key": apiSecret,
            }
          : {},
      });
      if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
      return (await res.json()) as T;
    },
    [apiOverrides]
  );

  const fetchAllData = useCallback(async () => {
    const { url: apiUrl, token: apiSecret } = resolveApiConfig(apiOverrides);
    if (!apiUrl) {
      if (__DEV__) {
        const { MOCK_STATUS, MOCK_SIGNALS, MOCK_TRADES, generateMockEquityHistory } =
          await import("@/__mocks__/tradingData");
        setStatus(MOCK_STATUS);
        setSignals(MOCK_SIGNALS);
        setTrades(MOCK_TRADES);
        setEquityHistory(generateMockEquityHistory(MOCK_STATUS.equity));
        setApiError("EXPO_PUBLIC_API_URL no configurada — mostrando datos de ejemplo");
        setUsingMockData(true);
      } else {
        setApiError("EXPO_PUBLIC_API_URL no configurada");
      }
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
      const signalsData = await safeFetch<Signal[]>("/api/signals");
      if (signalsData) {
        signalsData.forEach((sig) => {
          if (!prevSignals.current.find((s) => s.id === sig.id) && shouldNotify("NEW_SIGNAL")) {
            sendLocalNotification(
              "NEW_SIGNAL",
              `🎯 Nueva señal ${sig.type} ${sig.symbol}`,
              `Entrada: ${sig.entry} | TP: ${sig.takeProfit} | SL: ${sig.stopLoss}`
            );
          }
        });
        setSignals(signalsData);
        prevSignals.current = signalsData;
      }

      // 3. Trades
      const tradesData = await safeFetch<Trade[]>("/api/trades");
      if (tradesData) {
        tradesData.forEach((trade) => {
          if (!prevTrades.current.find((t) => t.id === trade.id) && shouldNotify("TRADE_CLOSE")) {
            const sign = trade.profit >= 0 ? "+" : "";
            sendLocalNotification(
              "TRADE_CLOSE",
              `✅ Operación cerrada en ${trade.symbol}`,
              `${trade.closeReason === "TAKE_PROFIT" ? "Take Profit 🎯" : "Stop Loss 🛡️"} (${sign}${trade.profit} €)`
            );
          }
        });
        setTrades(tradesData);
        prevTrades.current = tradesData;
      }

      // 4. Equity history (optional — server may return 500 if table is empty)
      const equityData = await safeFetch<EquityPoint[]>("/api/equityHistory").catch(
        () => null
      );
      if (equityData) setEquityHistory(equityData);

      setApiError(null);
      setUsingMockData(false);
      setLastSyncAt(new Date());
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("Error polling trading bot API:", msg);
      setApiError(`Sin conexión con el servidor (${msg})`);

      // Fall back to mock data only in dev and only on the first fetch
      if (__DEV__ && status === null) {
        const { MOCK_STATUS, MOCK_SIGNALS, MOCK_TRADES, generateMockEquityHistory } =
          await import("@/__mocks__/tradingData");
        setStatus(MOCK_STATUS);
        setSignals(MOCK_SIGNALS);
        setTrades(MOCK_TRADES);
        setEquityHistory(generateMockEquityHistory(MOCK_STATUS.equity));
        setUsingMockData(true);
      }
    } finally {
      setLoading(false);
    }
  }, [safeFetch, status, shouldNotify, apiOverrides]);

  useEffect(() => {
    fetchAllData();
    if (!settings.autoRefresh) return;
    const interval = setInterval(fetchAllData, settings.pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchAllData, settings.autoRefresh, settings.pollIntervalMs, apiOverrides.url, apiOverrides.token]);

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
          alert(`Error al ejecutar señal: ${data.message ?? "Desconocido"}`);
        }
      } catch (error) {
        console.error("Error accepting signal:", error);
        alert("Error de conexión al aceptar la señal.");
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
          alert("Error al rechazar la señal.");
        }
      } catch (error) {
        console.error("Error rejecting signal:", error);
        alert("Error de conexión al rechazar la señal.");
      } finally {
        setLoading(false);
      }
    },
    [fetchAllData, apiOverrides]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchAllData();
    setLoading(false);
  }, [fetchAllData]);

  return (
    <TradingContext.Provider
      value={{
        status,
        signals,
        trades,
        equityHistory,
        dailyPnL,
        winrate,
        openPositions,
        pendingSignals,
        loading,
        apiError,
        usingMockData,
        acceptSignal,
        rejectSignal,
        refresh,
        lastSyncAt,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error("useTrading must be used inside TradingProvider");
  return ctx;
}
