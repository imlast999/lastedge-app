/**
 * researchApi.ts — Cliente tipado para los endpoints de investigación cuantitativa.
 *
 * Consume:
 *   GET /api/research/exit-research          → lista de runs
 *   GET /api/research/exit-research/:runId   → detalle completo de un run
 */
import { resolveApiConfig } from "@/lib/apiConfig";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ExitResearchRun {
  run_id:          string;
  generated_at:    string;
  symbol:          string;
  validation_mode: string | null;
  variant_count:   number;
  best_variant:    string | null;
  best_pf:         number | null;
  best_stability:  number | null;
}

export interface ResearchExperiment {
  id:                     number;
  experiment_id:          string;
  title:                  string;
  hypothesis:             string | null;
  symbol:                 string;
  strategy:               string;
  timeframe:              string;
  bars_count:             number;
  bot_version:            string;
  git_commit:             string | null;
  status:                 string;
  decision_status:        "DRAFT" | "CANDIDATE" | "PROMOTED" | "REJECTED" | "ARCHIVED";
  decision_notes:         string | null;
  tags:                   string[] | string | null;
  notes:                  string | null;
  best_variant:           string | null;
  best_profit_factor:     number | null;
  best_winrate:           number | null;
  best_stability_score:   number | null;
  best_max_drawdown:      number | null;
  best_sharpe:            number | null;
  config_json?:           any;
  metrics_json?:          any;
  created_at:             string;
  updated_at:             string;
}

/** Variante enriquecida con todos los datos del nivel 20k. */
export interface ExitVariant {
  // Identidad
  rank:             number;
  variant:          string;
  // P&L
  profit_factor:    number;
  winrate:          number;
  total_pips:       number;
  avg_win:          number;
  avg_loss:         number;
  expectancy:       number | null;
  // Riesgo
  max_drawdown:     number;
  sharpe:           number;
  sortino:          number | null;
  calmar:           number | null;
  recovery_factor:  number | null;
  stability_score:  number;
  // Rachas / duración
  signals:          number | null;
  wins:             number | null;
  losses:           number | null;
  longest_loss_streak: number | null;
  avg_duration_bars:   number | null;
  // MAE / MFE
  mae_mean:         number;
  mfe_mean:         number;
  mae_winners:      number;
  mae_losers:       number;
  mfe_winners:      number;
  mfe_losers:       number;
  profit_captured_pct: number;
  // Walk-Forward / Monte Carlo
  wf_stability:     string | null;
  mc_prob_ruin:     number | null;
  mc_prob_profit:   number | null;
  // Degradación PF por nivel
  pf_5k:  number | null;
  pf_10k: number | null;
  pf_15k: number | null;
  pf_20k: number | null;
}

export interface ExitResearchConclusions {
  highest_profit:         string | null;
  lowest_drawdown:        string | null;
  most_robust:            string | null;
  best_walk_forward:      string | null;
  lowest_ruin_probability: string | null;
  recommended_for_live:   string | null;
}

export interface ExitResearchDetail {
  run_id:          string;
  generated_at:    string;
  symbol:          string;
  validation_mode: string | null;
  conclusions:     ExitResearchConclusions | null;
  comparison:      ExitVariant[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}`, "X-Api-Key": token };
}

async function apiFetch<T>(
  path: string,
  overrides?: { url?: string; token?: string }
): Promise<T> {
  const { url, token } = resolveApiConfig(overrides);
  const res = await fetch(`${url}${path}`, { headers: authHeaders(token) });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error((data as any).message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Devuelve la lista de todos los runs de Exit Research disponibles. */
export async function listExitResearchRuns(
  overrides?: { url?: string; token?: string }
): Promise<ExitResearchRun[]> {
  const data = await apiFetch<{ ok: boolean; runs: ExitResearchRun[] }>(
    "/api/research/exit-research",
    overrides
  );
  return data.runs;
}

/** Devuelve el detalle completo (todas las variantes + métricas) de un run. */
export async function fetchExitResearchDetail(
  runId: string,
  overrides?: { url?: string; token?: string }
): Promise<ExitResearchDetail> {
  return apiFetch<ExitResearchDetail>(
    `/api/research/exit-research/${encodeURIComponent(runId)}`,
    overrides
  );
}

// ── Equity Curve ──────────────────────────────────────────────────────────────

/** Un punto de la equity curve acumulada. */
export interface EquityCurvePoint {
  trade_index:   number;  // número ordinal del trade (eje X)
  bar_index:     number;  // índice de vela en el dataset
  exit_bar:      number;
  result:        "WIN" | "LOSS";
  profit_pips:   number;  // P&L del trade individual
  equity:        number;  // equity acumulada hasta este punto
  drawdown:      number;  // drawdown en pips desde el último pico
  mae_pips:      number;
  mfe_pips:      number;
  duration_bars: number;
  is_new_high:   boolean;
}

export interface EquityCurveData {
  variant:       string;
  total_trades:  number;
  final_equity:  number;
  max_drawdown:  number;
  new_highs:     number;
  wins:          number;
  losses:        number;
  points:        EquityCurvePoint[];
}

/**
 * Carga la equity curve de una variante.
 * step > 1 para decimación (reduce el payload para variantes con muchos trades).
 */
export async function fetchEquityCurve(
  runId: string,
  variant: string,
  step = 1,
  overrides?: { url?: string; token?: string }
): Promise<EquityCurveData> {
  const params = new URLSearchParams({ variant });
  if (step > 1) params.set("step", String(step));
  return apiFetch<EquityCurveData>(
    `/api/research/exit-research/${encodeURIComponent(runId)}/equity?${params}`,
    overrides
  );
}

// ── Trade Timeline ────────────────────────────────────────────────────────────

/** Un trade individual enriquecido con equity acumulada hasta ese punto. */
export interface ResearchTrade {
  trade_index:   number;
  variant:       string;
  result:        "WIN" | "LOSS";
  profit_pips:   number;
  equity:        number;   // equity acumulada en ese punto
  drawdown:      number;   // drawdown en pips desde el pico anterior
  mae_pips:      number;
  mfe_pips:      number;
  duration_bars: number;
  bar_index:     number;
  exit_bar:      number;
  is_new_high:   boolean;
  timestamp?:    string;
}

export interface TradePageStats {
  wins:              number;
  losses:            number;
  avg_mae_pips:      number;
  avg_mfe_pips:      number;
  avg_duration_bars: number;
}

export interface TradesPage {
  variant:  string;
  total:    number;
  page:     number;
  limit:    number;
  has_more: boolean;
  stats:    TradePageStats;
  trades:   ResearchTrade[];
}

/** Carga una página de trades de una variante.
 * result: "WIN" | "LOSS" | undefined (todos)
 */
export async function fetchVariantTrades(
  runId: string,
  variant: string,
  options?: {
    page?:   number;
    limit?:  number;
    result?: "WIN" | "LOSS";
    overrides?: { url?: string; token?: string };
  }
): Promise<TradesPage> {
  const { page = 0, limit = 50, result, overrides } = options ?? {};
  const params = new URLSearchParams({ variant, page: String(page), limit: String(limit) });
  if (result) params.set("result", result);
  return apiFetch<TradesPage>(
    `/api/research/exit-research/${encodeURIComponent(runId)}/trades?${params}`,
    overrides
  );
}

// ── Monte Carlo Fan Chart ──────────────────────────────────────────────────────

export interface MonteCarloFanData {
  variant:  string;
  p5:       number[];
  p25:      number[];
  p50:      number[];
  p75:      number[];
  p95:      number[];
  original: number[];
}

/** Carga los datos de percentiles de Monte Carlo para una variante. */
export async function fetchMonteCarloFan(
  runId: string,
  variant: string,
  overrides?: { url?: string; token?: string }
): Promise<MonteCarloFanData> {
  const params = new URLSearchParams({ variant });
  return apiFetch<MonteCarloFanData>(
    `/api/research/exit-research/${encodeURIComponent(runId)}/montecarlo?${params}`,
    overrides
  );
}

// ── Run Exit Research ────────────────────────────────────────────────────────

export interface RunExitResearchResult {
  ok: boolean;
  taskId?: number;
  message?: string;
}

/**
 * Ejecuta / encola una simulación de Exit Research.
 * POST /api/research/exit-research
 */
export async function runExitResearch(
  params: { strategy: string; symbol: string },
  overrides?: { url?: string; token?: string }
): Promise<RunExitResearchResult> {
  const { url, token } = resolveApiConfig(overrides);
  const res = await fetch(`${url}/api/research/exit-research`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error((data as any).message ?? `HTTP ${res.status}`);
  }
  return data as RunExitResearchResult;
}

// ── Research Database CRUD ───────────────────────────────────────────────────

export interface ListExperimentsOptions {
  symbol?:          string;
  strategy?:        string;
  decision_status?: string;
  tag?:             string;
  search?:          string;
  min_pf?:          number;
  page?:            number;
  limit?:           number;
  overrides?:       { url?: string; token?: string };
}

export async function listResearchExperiments(
  options?: ListExperimentsOptions
): Promise<{ total: number; experiments: ResearchExperiment[] }> {
  const { symbol, strategy, decision_status, tag, search, min_pf, page = 0, limit = 20, overrides } = options ?? {};
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (symbol) params.set("symbol", symbol);
  if (strategy) params.set("strategy", strategy);
  if (decision_status) params.set("decision_status", decision_status);
  if (tag) params.set("tag", tag);
  if (search) params.set("search", search);
  if (min_pf !== undefined) params.set("min_pf", String(min_pf));

  const data = await apiFetch<{ ok: boolean; total: number; experiments: ResearchExperiment[] }>(
    `/api/research/experiments?${params}`,
    overrides
  );
  return { total: data.total, experiments: data.experiments };
}

export async function fetchResearchExperimentDetail(
  expId: string,
  overrides?: { url?: string; token?: string }
): Promise<ResearchExperiment> {
  const data = await apiFetch<{ ok: boolean; experiment: ResearchExperiment }>(
    `/api/research/experiments/${encodeURIComponent(expId)}`,
    overrides
  );
  return data.experiment;
}

export async function updateResearchExperiment(
  expId: string,
  updates: Partial<ResearchExperiment>,
  overrides?: { url?: string; token?: string }
): Promise<boolean> {
  const { url, token } = resolveApiConfig(overrides);
  const res = await fetch(`${url}/api/research/experiments/${encodeURIComponent(expId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error((data as any).message ?? `HTTP ${res.status}`);
  }
  return true;
}

export async function fetchReopenPayload(
  expId: string,
  overrides?: { url?: string; token?: string }
): Promise<any> {
  const data = await apiFetch<{ ok: boolean; reproducible_payload: any }>(
    `/api/research/experiments/${encodeURIComponent(expId)}/reopen`,
    overrides
  );
  return data.reproducible_payload;
}
