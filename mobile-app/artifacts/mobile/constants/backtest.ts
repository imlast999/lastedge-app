export const BACKTEST_SYMBOLS = ["EURUSD", "XAUUSD", "BTCEUR"] as const;

export type BacktestSymbol = (typeof BACKTEST_SYMBOLS)[number];

export const STRATEGIES_BY_SYMBOL: Record<BacktestSymbol, string[]> = {
  EURUSD: [
    "eurusd_partial",
    "eurusd_flow",
    "eurusd_london_expansion",
    "eurusd_public_trend",
    "eurusd_simple",
  ],
  XAUUSD: [
    "xauusd_asian_london",
    "xauusd_partial",
    "xauusd_surge",
    "xauusd_statistical_reversal",
    "xauusd_public_breakout",
    "xauusd_simple",
  ],
  BTCEUR: [
    "btceur_partial",
    "btceur_trend_surge",
    "btceur_volatility_breakout",
    "btceur_public_momentum",
    "btceur_simple",
    "btc_trend_pullback_v1",
  ],
};

export const DEFAULT_STRATEGY: Record<BacktestSymbol, string> = {
  EURUSD: "eurusd_partial",
  XAUUSD: "xauusd_asian_london",
  BTCEUR: "btceur_partial",
};

export const DEFAULT_BARS = 3000;
export const DEFAULT_CB_LOSSES = 4;
export const DEFAULT_CB_PAUSE = 168;
