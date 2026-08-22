/**
 * Mock data used ONLY for development / Storybook / offline testing.
 * Never imported in production flows — only via TradingContext when
 * the API is unreachable AND __DEV__ is true.
 */
import type { BotStatus, Signal, Trade, EquityPoint } from "@/context/TradingContext";

export const MOCK_STATUS: BotStatus = {
  connected: false,          // explicitly false so the UI shows "offline"
  uptime: "–",
  balance: 10524.32,
  equity: 10612.45,
  margin: 312.5,
  freeMargin: 10299.95,
};

export const MOCK_SIGNALS: Signal[] = [
  {
    id: "sig-001",
    symbol: "EURUSD",
    type: "BUY",
    entry: 1.08542,
    takeProfit: 1.09200,
    stopLoss: 1.08100,
    status: "pending",
    rrRatio: 1.49,
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    lot: 0.1,
  },
  {
    id: "sig-002",
    symbol: "XAUUSD",
    type: "SELL",
    entry: 2312.50,
    takeProfit: 2290.00,
    stopLoss: 2325.00,
    status: "pending",
    rrRatio: 1.73,
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    lot: 0.05,
  },
  {
    id: "sig-003",
    symbol: "GBPJPY",
    type: "BUY",
    entry: 192.450,
    takeProfit: 193.100,
    stopLoss: 192.000,
    status: "active",
    rrRatio: 1.44,
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    lot: 0.1,
  },
];

export const MOCK_TRADES: Trade[] = [
  {
    id: "trade-001",
    symbol: "EURUSD",
    type: "BUY",
    openPrice: 1.08120,
    closePrice: 1.08780,
    pips: 66,
    profit: 66.0,
    closeReason: "TAKE_PROFIT",
    closedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    lot: 0.1,
  },
  {
    id: "trade-002",
    symbol: "XAUUSD",
    type: "SELL",
    openPrice: 2325.0,
    closePrice: 2335.0,
    pips: -100,
    profit: -50.0,
    closeReason: "STOP_LOSS",
    closedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    lot: 0.05,
  },
  {
    id: "trade-003",
    symbol: "GBPUSD",
    type: "BUY",
    openPrice: 1.27450,
    closePrice: 1.28100,
    pips: 65,
    profit: 65.0,
    closeReason: "TAKE_PROFIT",
    closedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    lot: 0.1,
  },
];

export function generateMockEquityHistory(baseEquity: number): EquityPoint[] {
  const points: EquityPoint[] = [];
  const now = Date.now();
  let value = baseEquity - 320;
  for (let i = 24; i >= 0; i--) {
    const time = now - i * 3600000;
    const change = (Math.random() - 0.38) * 60;
    value = Math.max(value + change, baseEquity - 500);
    points.push({ time, value: parseFloat(value.toFixed(2)) });
  }
  points[points.length - 1] = { time: now, value: baseEquity };
  return points;
}
