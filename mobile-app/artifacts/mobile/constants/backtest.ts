export const BACKTEST_SYMBOLS = ["EURUSD", "XAUUSD", "BTCEUR"] as const;

export type BacktestSymbol = (typeof BACKTEST_SYMBOLS)[number];

export const STRATEGIES_BY_SYMBOL: Record<BacktestSymbol, string[]> = {
  EURUSD: ["eurusd_simple", "eurusd_advanced", "eurusd_mtf", "eurusd_asian_breakout"],
  XAUUSD: ["xauusd_simple", "xauusd_reversal", "xauusd_momentum", "xauusd_psychological"],
  BTCEUR: ["btceur_simple", "btc_trend_pullback_v1", "btceur_weekly_breakout"],
};

export const DEFAULT_STRATEGY: Record<BacktestSymbol, string> = {
  EURUSD: "eurusd_asian_breakout",
  XAUUSD: "xauusd_simple",
  BTCEUR: "btceur_simple",
};

export const DEFAULT_BARS = 3000;
export const DEFAULT_CB_LOSSES = 4;
export const DEFAULT_CB_PAUSE = 168;
