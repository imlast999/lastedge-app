/**
 * LastEdge Mobile — Institutional Demo Sandbox Data
 * High-fidelity simulated telemetry so new users and Google Play testers
 * experience a rich, fully-functional terminal before connecting a live VPS.
 */

import { BotStatus, Position, Signal, Trade, EquityPoint } from "@/context/TradingContext";

export const DEMO_BOT_STATUS: BotStatus = {
  connected: true,
  uptime: "4d 18h 32m",
  balance: 10000.0,
  equity: 10482.5,
  margin: 420.0,
  freeMargin: 10062.5,
  currency: "USD",
  circuitBreakerActive: false,
  executionQuality: {
    avgLatency: 14.2,
    avgSlippage: 0.12,
    successRate: 99.4,
  },
};

export const DEMO_EQUITY_HISTORY: EquityPoint[] = (() => {
  const points: EquityPoint[] = [];
  const now = Math.floor(Date.now() / 1000);
  const hourStep = 3600;

  // Realistic equity curve over 24 hours: starts at 10,000 and organically climbs to 10,482.50
  const values = [
    10000.0, 10025.0, 10060.0, 10045.0, 10090.0, 10140.0, 10125.0, 10185.0,
    10210.0, 10190.0, 10245.0, 10280.0, 10260.0, 10310.0, 10340.0, 10325.0,
    10375.0, 10410.0, 10395.0, 10430.0, 10460.0, 10445.0, 10470.0, 10482.5,
  ];

  for (let i = 0; i < values.length; i++) {
    points.push({
      time: now - (values.length - 1 - i) * hourStep,
      value: values[i],
    });
  }

  return points;
})();

export const DEMO_POSITIONS: Position[] = [
  {
    ticket: 9482101,
    symbol: "BTCUSD",
    type: "BUY",
    volume: 0.2,
    open_price: 88400.0,
    current_price: 89650.0,
    sl: 88520.0, // Monotonic Break-Even locked (+0.2R)
    tp: 91200.0,
    profit: 250.0,
    swap: 0.0,
    magic: 808101,
    comment: "TrendSurge-M15 · Ratchet Active",
    time: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    spread: 1.2,
  },
  {
    ticket: 9482102,
    symbol: "EURUSD",
    type: "SELL",
    volume: 0.5,
    open_price: 1.0845,
    current_price: 1.0818,
    sl: 1.0839, // Trailing stop locked in profit
    tp: 1.076,
    profit: 135.0,
    swap: -1.2,
    magic: 808102,
    comment: "LiquiditySweep-H1 · BE Protected",
    time: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    spread: 0.4,
  },
  {
    ticket: 9482103,
    symbol: "XAUUSD",
    type: "BUY",
    volume: 0.1,
    open_price: 2710.0,
    current_price: 2719.75,
    sl: 2712.0,
    tp: 2735.0,
    profit: 97.5,
    swap: 0.0,
    magic: 808103,
    comment: "GoldBreakout-H4 · Trailing",
    time: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    spread: 1.8,
  },
];

export const DEMO_SIGNALS: Signal[] = [
  {
    id: "sig_demo_01",
    symbol: "USDJPY",
    type: "BUY",
    entry: 154.2,
    stopLoss: 153.75,
    takeProfit: 155.4,
    status: "pending",
    rrRatio: 2.67,
    timestamp: new Date(Date.now() - 120 * 1000).toISOString(),
    lot: 0.3,
    score: 0.84,
    confidence: "84%",
    autoExecuted: false,
    strategy: "TrendSurge v4.2 [H4 Sweep + ATR]",
  },
  {
    id: "sig_demo_02",
    symbol: "US30",
    type: "SELL",
    entry: 43850.0,
    stopLoss: 44050.0,
    takeProfit: 43300.0,
    status: "pending",
    rrRatio: 2.75,
    timestamp: new Date(Date.now() - 300 * 1000).toISOString(),
    lot: 0.15,
    score: 0.76,
    confidence: "76%",
    autoExecuted: false,
    strategy: "OrderFlow Institutional [Delta -1.4M]",
  },
];

export const DEMO_TRADES: Trade[] = [
  {
    id: "trade_demo_01",
    symbol: "BTCUSD",
    type: "BUY",
    openPrice: 87100.0,
    closePrice: 88550.0,
    pips: 1450,
    profit: 185.0,
    closeReason: "TAKE_PROFIT",
    closedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    lot: 0.2,
    comment: "TrendSurge-M15",
    latencyMs: 12,
    slippagePips: 0.1,
  },
  {
    id: "trade_demo_02",
    symbol: "EURUSD",
    type: "SELL",
    openPrice: 1.089,
    closePrice: 1.0842,
    pips: 48,
    profit: 94.2,
    closeReason: "TRAILING_STOP",
    closedAt: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
    lot: 0.5,
    comment: "LiquiditySweep-H1",
    latencyMs: 15,
    slippagePips: 0.0,
  },
  {
    id: "trade_demo_03",
    symbol: "GBPUSD",
    type: "BUY",
    openPrice: 1.298,
    closePrice: 1.2959,
    pips: -21,
    profit: -42.0,
    closeReason: "STOP_LOSS",
    closedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    lot: 0.4,
    comment: "Breakout-M30",
    latencyMs: 18,
    slippagePips: 0.2,
  },
  {
    id: "trade_demo_04",
    symbol: "US30",
    type: "BUY",
    openPrice: 43400.0,
    closePrice: 43690.0,
    pips: 290,
    profit: 145.0,
    closeReason: "PARTIAL_TP",
    closedAt: new Date(Date.now() - 19 * 3600 * 1000).toISOString(),
    lot: 0.2,
    comment: "OrderFlow-H1",
    latencyMs: 11,
    slippagePips: 0.0,
  },
  {
    id: "trade_demo_05",
    symbol: "XAUUSD",
    type: "SELL",
    openPrice: 2728.5,
    closePrice: 2718.0,
    pips: 105,
    profit: 62.8,
    closeReason: "TAKE_PROFIT",
    closedAt: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
    lot: 0.1,
    comment: "GoldBreakout-H4",
    latencyMs: 14,
    slippagePips: 0.1,
  },
];
