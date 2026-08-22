import { resolveApiConfig } from "@/lib/apiConfig";

export type BacktestTaskStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface BacktestTaskSummary {
  id: number;
  symbol: string;
  strategy: string;
  bars: number;
  status: BacktestTaskStatus;
  created_at?: string | null;
  updated_at?: string | null;
  error_message?: string | null;
}

export interface MonteCarloResults {
  status: string;
  prob_profitable?: number;
  prob_ruin?: number;
  p50_drawdown?: number;
  p95_drawdown?: number;
  p5_equity?: number;
  p50_equity?: number;
  p95_equity?: number;
  reason?: string;
  message?: string;
}

export interface BacktestResults {
  symbol: string;
  strategy: string;
  bars_analyzed: number;
  signals_final: number;
  winrate: number;
  profit_factor: string;
  total_pips: number;
  max_streak: number;
  monte_carlo?: MonteCarloResults;
}

export interface BacktestTaskDetail extends BacktestTaskSummary {
  results: BacktestResults | null;
  errorMessage?: string | null;
}

function authHeaders(token: string): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}`, "X-Api-Key": token };
}

export async function queueBacktest(
  params: {
    symbol: string;
    strategy: string;
    bars: number;
    cb_losses?: number;
    cb_pause?: number;
  },
  overrides?: { url?: string; token?: string }
): Promise<number> {
  const { url, token } = resolveApiConfig(overrides);
  const res = await fetch(`${url}/api/backtests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
  return data.taskId as number;
}

export async function fetchBacktestTask(
  taskId: number,
  overrides?: { url?: string; token?: string }
): Promise<BacktestTaskDetail> {
  const { url, token } = resolveApiConfig(overrides);
  const res = await fetch(`${url}/api/backtests/${taskId}`, {
    headers: authHeaders(token),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
  return {
    id: data.taskId,
    symbol: data.symbol,
    strategy: data.strategy,
    bars: data.bars,
    status: data.status,
    results: data.results,
    errorMessage: data.errorMessage,
  };
}

export async function listBacktestTasks(
  overrides?: { url?: string; token?: string }
): Promise<BacktestTaskSummary[]> {
  const { url, token } = resolveApiConfig(overrides);
  const res = await fetch(`${url}/api/backtests`, { headers: authHeaders(token) });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
  return data.tasks as BacktestTaskSummary[];
}
