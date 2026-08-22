/**
 * Research routes — lee artefactos generados por los scripts de Python
 * directamente del filesystem (backtest_results/).
 *
 * Endpoints:
 *   GET /api/research/exit-research
 *       Lista todos los runs de Exit Research disponibles.
 *
 *   GET /api/research/exit-research/:runId
 *       Devuelve el summary.json completo de un run específico,
 *       enriquecido con los datos de mae_mfe.csv y la tabla de degradación.
 *
 * Arquitectura de acceso:
 *   Los resultados del research son archivos estáticos en el filesystem.
 *   Este router los lee directamente sin tocar bot_state.db.
 *   Ninguna modificación al bot Python es necesaria.
 *
 * Path de resultados: RESEARCH_BASE_PATH (env BOT_RESULTS_PATH o auto-resuelto)
 */
import { Router, Request, Response } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "../lib/logger.js";
import { run, query, queryOne } from "../lib/db.js";

import { fileURLToPath } from "node:url";

export const researchRouter = Router();

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "start_all.bat")) || fs.existsSync(path.join(dir, "requirements.txt"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir, "..", "..", "..", "..", "..");
}

// ── Resolver ruta base de backtest_results ────────────────────────────────────
function resolveResultsBase(): string {
  if (process.env.BOT_RESULTS_PATH) {
    return process.env.BOT_RESULTS_PATH;
  }
  const root = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
  return path.join(root, "backtest_results");
}

const RESULTS_BASE = resolveResultsBase();
const EXIT_RESEARCH_DIR = path.join(RESULTS_BASE, "exit_research");
const VALIDATION_DIR    = path.join(RESULTS_BASE, "validation");

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJsonSafe<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Parsea un CSV simple (primera fila = cabecera) y devuelve array de objetos. */
function parseCsv(filePath: string): Record<string, string>[] {
  try {
    const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
      return row;
    });
  } catch {
    return [];
  }
}

/**
 * Construye la equity curve acumulada desde un array de trades.
 * Devuelve puntos {trade_id, equity, drawdown, result, profit_pips, mae, mfe, duration}.
 */
function buildEquityCurve(trades: Record<string, string>[]) {
  let equity = 0;
  let peak   = 0;
  return trades.map((t) => {
    const pips = parseFloat(t.profit_pips ?? "0") || 0;
    equity += pips;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? peak - equity : 0;
    const isNewHigh = equity >= peak && pips > 0;
    return {
      trade_id:     parseInt(t.trade_id ?? "0", 10),
      trade_index:  parseInt(t.trade_id ?? "0", 10),  // eje X ordinal
      bar_index:    parseInt(t.bar_index ?? "0", 10),
      exit_bar:     parseInt(t.exit_bar  ?? "0", 10),
      result:       t.result ?? "LOSS",
      profit_pips:  parseFloat(pips.toFixed(4)),
      equity:       parseFloat(equity.toFixed(4)),
      drawdown:     parseFloat(dd.toFixed(4)),
      mae_pips:     parseFloat(t.mae_pips ?? "0") || 0,
      mfe_pips:     parseFloat(t.mfe_pips ?? "0") || 0,
      duration_bars: parseInt(t.duration_bars ?? "0", 10),
      is_new_high:  isNewHigh,
    };
  });
}

/** Convierte un run_id de formato YYYYMMDD_HHMMSS a ISO string legible. */
function runIdToIso(runId: string): string {
  // "20260702_225143" → "2026-07-02T22:51:43Z"
  const m = runId.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!m) return runId;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

// ── GET /api/research/exit-research ──────────────────────────────────────────
// Lista todos los runs disponibles con sus metadatos básicos.

researchRouter.get("/exit-research", (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(EXIT_RESEARCH_DIR)) {
      res.json({ ok: true, runs: [] });
      return;
    }

    const entries = fs.readdirSync(EXIT_RESEARCH_DIR, { withFileTypes: true });
    const runs: object[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const runId = entry.name;
      const summaryPath = path.join(EXIT_RESEARCH_DIR, runId, "summary.json");
      if (!fs.existsSync(summaryPath)) continue;

      const summary = readJsonSafe<any>(summaryPath);
      if (!summary) continue;

      // Extraer solo los campos necesarios para el listado
      const best = summary.comparison_table?.[0] ?? null;
      runs.push({
        run_id:        summary.run_id ?? runId,
        generated_at:  summary.generated_at ?? runIdToIso(runId),
        symbol:        summary.symbol ?? "UNKNOWN",
        validation_mode: summary.validation_mode ?? null,
        variant_count: summary.comparison_table?.length ?? 0,
        best_variant:  best?.variant ?? null,
        best_pf:       best?.profit_factor ?? null,
        best_stability: best?.stability_score ?? null,
      });
    }

    // Más reciente primero
    runs.sort((a: any, b: any) =>
      (b.run_id ?? "").localeCompare(a.run_id ?? "")
    );

    res.json({ ok: true, runs });
  } catch (err) {
    logger.error({ err }, "GET /api/research/exit-research error");
    res.status(500).json({ ok: false, message: "Failed to list exit research runs" });
  }
});

// ── POST /api/research/exit-research ─────────────────────────────────────────

researchRouter.post("/exit-research", (req: Request, res: Response) => {
  const { symbol, strategy } = req.body;
  if (!symbol || !strategy) {
    res.status(400).json({ ok: false, message: "Missing required parameters: strategy and symbol" });
    return;
  }

  try {
    const result = run(
      `INSERT INTO backtest_tasks (symbol, strategy, bars, cb_losses, cb_pause, status)
       VALUES (?, ?, 20000, 4, 168, 'PENDING')`,
      [String(symbol).toUpperCase(), String(strategy), 20000, 4, 168]
    );

    res.json({ ok: true, taskId: result.lastInsertRowid, message: "Exit research task queued successfully" });
  } catch (err) {
    logger.error({ err }, "POST /api/research/exit-research error");
    res.status(500).json({ ok: false, message: "Failed to queue exit research task" });
  }
});

// ── GET /api/research/exit-research/:runId ────────────────────────────────────
// Detalle completo de un run: comparison_table, degradation_table,
// mae_mfe por variante, y métricas completas del nivel máximo (20k).

researchRouter.get("/exit-research/:runId", (req: Request, res: Response) => {
  const { runId } = req.params as { runId: string };

  // Validación básica del runId para evitar path traversal
  if (!runId || !/^[\w-]+$/.test(runId)) {
    res.status(400).json({ ok: false, message: "Invalid run ID" });
    return;
  }

  const runDir = path.join(EXIT_RESEARCH_DIR, runId);
  if (!fs.existsSync(runDir)) {
    res.status(404).json({ ok: false, message: "Run not found" });
    return;
  }

  try {
    // 1. summary.json — fuente principal
    const summary = readJsonSafe<any>(path.join(runDir, "summary.json"));
    if (!summary) {
      res.status(404).json({ ok: false, message: "summary.json not found or invalid" });
      return;
    }

    // 2. mae_mfe.csv — enriquece cada variante con datos MAE/MFE detallados
    const maeMfeRows = parseCsv(path.join(runDir, "mae_mfe.csv"));
    const maeMfeByVariant: Record<string, Record<string, string>> = {};
    for (const row of maeMfeRows) {
      if (row.variant) maeMfeByVariant[row.variant] = row;
    }

    // 3. Construir tabla comparativa enriquecida
    // Para cada variante del comparison_table, añadimos:
    //   - mae_winners, mae_losers, mfe_winners, mfe_losers del mae_mfe.csv
    //   - métricas completas del nivel 20k (desde results[variant]["20000"])
    //   - tabla de degradación (desde degradation_table)
    const maxLevel = "20000";
    const comparison = (summary.comparison_table ?? []).map((row: any) => {
      const variantId = row.variant;
      const maeMfe    = maeMfeByVariant[variantId] ?? {};
      const fullMetrics = summary.results?.[variantId]?.[maxLevel]?.metrics ?? null;
      const degradation = summary.degradation_table?.[variantId] ?? null;

      return {
        // Ranking básico
        rank:             row.rank,
        variant:          variantId,
        profit_factor:    row.profit_factor,
        winrate:          row.winrate,
        total_pips:       row.total_pips,
        max_drawdown:     row.max_drawdown,
        sharpe:           row.sharpe,
        stability_score:  row.stability_score,
        sortino:          row.sortino,
        calmar:           row.calmar,
        recovery_factor:  row.recovery_factor,
        mc_prob_ruin:     row.mc_prob_ruin,
        mc_prob_profit:   row.mc_prob_profit,
        wf_stability:     fullMetrics?.wf_stability ?? null,
        // MAE / MFE — priorizar mae_mfe.csv, caer a fullMetrics si no existe
        mae_mean:         parseFloat(maeMfe.mae_mean  ?? "0") || (fullMetrics?.mae_mean  ?? 0),
        mfe_mean:         parseFloat(maeMfe.mfe_mean  ?? "0") || (fullMetrics?.mfe_mean  ?? 0),
        mae_winners:      parseFloat(maeMfe.mae_winners ?? "0") || (fullMetrics?.mae_winners ?? 0),
        mae_losers:       parseFloat(maeMfe.mae_losers  ?? "0") || (fullMetrics?.mae_losers  ?? 0),
        mfe_winners:      parseFloat(maeMfe.mfe_winners ?? "0") || (fullMetrics?.mfe_winners ?? 0),
        mfe_losers:       parseFloat(maeMfe.mfe_losers  ?? "0") || (fullMetrics?.mfe_losers  ?? 0),
        profit_captured_pct: parseFloat(maeMfe.profit_captured_pct ?? "0") || (fullMetrics?.profit_captured_pct ?? 0),
        avg_win:          parseFloat(maeMfe.avg_win  ?? "0") || (fullMetrics?.avg_win  ?? 0),
        avg_loss:         parseFloat(maeMfe.avg_loss ?? "0") || (fullMetrics?.avg_loss ?? 0),
        // Métricas adicionales del nivel 20k
        signals:          fullMetrics?.signals ?? null,
        wins:             fullMetrics?.wins ?? null,
        losses:           fullMetrics?.losses ?? null,
        expectancy:       fullMetrics?.expectancy ?? null,
        longest_loss_streak: fullMetrics?.longest_loss_streak ?? null,
        avg_duration_bars:   fullMetrics?.avg_duration_bars ?? null,
        // Degradación PF entre niveles
        pf_5k:    degradation?.["5000"]  ?? null,
        pf_10k:   degradation?.["10000"] ?? null,
        pf_15k:   degradation?.["15000"] ?? null,
        pf_20k:   degradation?.["20000"] ?? null,
      };
    });

    res.json({
      ok: true,
      run_id:          summary.run_id,
      generated_at:    summary.generated_at,
      symbol:          summary.symbol,
      validation_mode: summary.validation_mode,
      conclusions:     summary.conclusions ?? null,
      comparison,
    });
  } catch (err) {
    logger.error({ err, runId }, "GET /api/research/exit-research/:runId error");
    res.status(500).json({ ok: false, message: "Failed to read exit research run" });
  }
});

// ── GET /api/research/exit-research/:runId/equity ────────────────────────────
// Devuelve la equity curve acumulada para una variante específica.
// Query params:
//   ?variant=partial_close   (requerido)
//   ?step=1                  (opcional, decimar cada N trades para reducir payload)
//
// Cada punto incluye: trade_id, equity acumulada, drawdown en ese punto,
// result (WIN/LOSS), profit_pips del trade, mae, mfe, duration_bars.
// El eje X es ordinal (número de trade), no tiempo real, porque trades.csv
// solo tiene bar_index (posición en la descarga de velas, no fecha ISO).

researchRouter.get(
  "/exit-research/:runId/equity",
  (req: Request, res: Response) => {
    const { runId } = req.params as { runId: string };

    if (!runId || !/^[\w-]+$/.test(runId)) {
      res.status(400).json({ ok: false, message: "Invalid run ID" });
      return;
    }

    const variantParam = req.query["variant"];
    const variant = typeof variantParam === "string" ? variantParam.trim() : "";

    if (!variant) {
      res.status(400).json({ ok: false, message: "?variant= is required" });
      return;
    }

    // Validar variante para evitar path traversal
    if (!/^[\w-]+$/.test(variant)) {
      res.status(400).json({ ok: false, message: "Invalid variant name" });
      return;
    }

    const stepRaw = req.query["step"];
    const step = Math.max(1, parseInt(typeof stepRaw === "string" ? stepRaw : "1", 10) || 1);

    const tradesPath = path.join(EXIT_RESEARCH_DIR, runId, "trades.csv");
    if (!fs.existsSync(tradesPath)) {
      res.status(404).json({ ok: false, message: "trades.csv not found for this run" });
      return;
    }

    try {
      // Leer y filtrar por variante
      const allTrades = parseCsv(tradesPath);
      const variantTrades = allTrades.filter(
        (t) => t.variant === variant && t.result !== "PENDING"
      );

      if (variantTrades.length === 0) {
        res.json({ ok: true, variant, total_trades: 0, points: [] });
        return;
      }

      // Construir equity curve completa
      const fullCurve = buildEquityCurve(variantTrades);

      // Decimación opcional para reducir payload en variantes con miles de trades
      const points = step <= 1
        ? fullCurve
        : fullCurve.filter((_, i) => i === 0 || i === fullCurve.length - 1 || i % step === 0);

      // Estadísticas resumidas para el header del gráfico
      const finalEquity = fullCurve[fullCurve.length - 1]?.equity ?? 0;
      const maxDrawdown = Math.max(...fullCurve.map((p) => p.drawdown));
      const newHighs    = fullCurve.filter((p) => p.is_new_high).length;
      const wins        = variantTrades.filter((t) => t.result === "WIN").length;
      const losses      = variantTrades.filter((t) => t.result === "LOSS").length;

      res.json({
        ok: true,
        variant,
        total_trades:  variantTrades.length,
        final_equity:  parseFloat(finalEquity.toFixed(2)),
        max_drawdown:  parseFloat(maxDrawdown.toFixed(2)),
        new_highs:     newHighs,
        wins,
        losses,
        points,
      });
    } catch (err) {
      logger.error({ err, runId, variant }, "GET /equity error");
      res.status(500).json({ ok: false, message: "Failed to build equity curve" });
    }
  }
);

// ── GET /api/research/exit-research/:runId/trades ────────────────────────────
// Devuelve los trades individuales de una variante, paginados.
// Query params:
//   ?variant=partial_close   (requerido)
//   ?page=0                  (página, 0-based, default 0)
//   ?limit=50                (trades por página, max 200, default 50)
//   ?result=WIN|LOSS         (filtro opcional por resultado)
//
// Cada trade incluye todos los campos del CSV más el número ordinal (trade_index)
// y el equity acumulada hasta ese punto para contexto.

researchRouter.get(
  "/exit-research/:runId/trades",
  (req: Request, res: Response) => {
    const { runId } = req.params as { runId: string };

    if (!runId || !/^[\w-]+$/.test(runId)) {
      res.status(400).json({ ok: false, message: "Invalid run ID" });
      return;
    }

    const variantRaw = req.query["variant"];
    const variant = typeof variantRaw === "string" ? variantRaw.trim() : "";
    if (!variant || !/^[\w-]+$/.test(variant)) {
      res.status(400).json({ ok: false, message: "?variant= is required" });
      return;
    }

    const pageRaw  = req.query["page"];
    const limitRaw = req.query["limit"];
    const resultFilter = req.query["result"];

    const page  = Math.max(0, parseInt(typeof pageRaw  === "string" ? pageRaw  : "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(typeof limitRaw === "string" ? limitRaw : "50", 10) || 50));
    const filterResult = typeof resultFilter === "string" ? resultFilter.toUpperCase() : null;

    const tradesPath = path.join(EXIT_RESEARCH_DIR, runId, "trades.csv");
    if (!fs.existsSync(tradesPath)) {
      res.status(404).json({ ok: false, message: "trades.csv not found for this run" });
      return;
    }

    try {
      const allTrades = parseCsv(tradesPath);
      const variantTrades = allTrades.filter(
        (t) => t.variant === variant && t.result !== "PENDING"
      );

      // Aplicar filtro de resultado si se especifica
      const filtered = filterResult
        ? variantTrades.filter((t) => t.result.toUpperCase() === filterResult)
        : variantTrades;

      // Calcular equity acumulada para cada trade
      const runDir = path.join(EXIT_RESEARCH_DIR, runId);
      const summary = readJsonSafe<any>(path.join(runDir, "summary.json"));

      let runningEquity = 0;
      let peak = 0;
      const enriched = variantTrades.map((t, globalIdx) => {
        const pips = parseFloat(t.profit_pips ?? "0") || 0;
        runningEquity += pips;
        if (runningEquity > peak) peak = runningEquity;
        const dd = peak > 0 ? peak - runningEquity : 0;

        let timestamp = t.timestamp;
        if (!timestamp) {
          const date = new Date(summary?.generated_at || Date.now());
          date.setHours(date.getHours() - (20000 - (parseInt(t.bar_index ?? "0", 10))));
          timestamp = date.toISOString();
        }

        return {
          trade_index:   globalIdx + 1,
          variant:       t.variant,
          result:        t.result as "WIN" | "LOSS",
          profit_pips:   parseFloat(pips.toFixed(4)),
          equity:        parseFloat(runningEquity.toFixed(4)),
          drawdown:      parseFloat(dd.toFixed(4)),
          mae_pips:      parseFloat(t.mae_pips ?? "0") || 0,
          mfe_pips:      parseFloat(t.mfe_pips ?? "0") || 0,
          duration_bars: parseInt(t.duration_bars ?? "0", 10),
          bar_index:     parseInt(t.bar_index ?? "0", 10),
          exit_bar:      parseInt(t.exit_bar  ?? "0", 10),
          is_new_high:   runningEquity >= peak && pips > 0,
          timestamp,
        };
      });

      // Filtrar por resultado DESPUÉS de calcular equity (mantiene contexto)
      const filteredEnriched = filterResult
        ? enriched.filter(t => t.result === filterResult)
        : enriched;

      // Paginación
      const total = filteredEnriched.length;
      const start = page * limit;
      const trades = filteredEnriched.slice(start, start + limit);
      const hasMore = start + limit < total;

      // Estadísticas del conjunto filtrado
      const wins   = filteredEnriched.filter(t => t.result === "WIN").length;
      const losses = filteredEnriched.filter(t => t.result === "LOSS").length;
      const avgMae = total > 0
        ? filteredEnriched.reduce((s, t) => s + t.mae_pips, 0) / total : 0;
      const avgMfe = total > 0
        ? filteredEnriched.reduce((s, t) => s + t.mfe_pips, 0) / total : 0;
      const avgDuration = total > 0
        ? filteredEnriched.reduce((s, t) => s + t.duration_bars, 0) / total : 0;

      res.json({
        ok: true,
        variant,
        total,
        page,
        limit,
        has_more: hasMore,
        stats: {
          wins,
          losses,
          avg_mae_pips:      parseFloat(avgMae.toFixed(2)),
          avg_mfe_pips:      parseFloat(avgMfe.toFixed(2)),
          avg_duration_bars: parseFloat(avgDuration.toFixed(1)),
        },
        trades,
      });
    } catch (err) {
      logger.error({ err, runId, variant }, "GET /trades error");
      res.status(500).json({ ok: false, message: "Failed to read trades" });
    }
  }
);

// ── GET /api/research/exit-research/:runId/montecarlo ─────────────────────────
// Devuelve las curvas de percentiles de Monte Carlo para una variante específica.
// Query params:
//   ?variant=partial_close   (requerido)
//   ?simulations=1000        (opcional, default 1000)

researchRouter.get(
  "/exit-research/:runId/montecarlo",
  (req: Request, res: Response) => {
    const { runId } = req.params as { runId: string };

    if (!runId || !/^[\w-]+$/.test(runId)) {
      res.status(400).json({ ok: false, message: "Invalid run ID" });
      return;
    }

    const variantParam = req.query["variant"];
    const variant = typeof variantParam === "string" ? variantParam.trim() : "";

    if (!variant || !/^[\w-]+$/.test(variant)) {
      res.status(400).json({ ok: false, message: "?variant= is required" });
      return;
    }

    const simsRaw = req.query["simulations"];
    const M = Math.min(2000, Math.max(100, parseInt(typeof simsRaw === "string" ? simsRaw : "1000", 10) || 1000));

    const tradesPath = path.join(EXIT_RESEARCH_DIR, runId, "trades.csv");
    if (!fs.existsSync(tradesPath)) {
      res.status(404).json({ ok: false, message: "trades.csv not found for this run" });
      return;
    }

    try {
      const allTrades = parseCsv(tradesPath);
      const variantTrades = allTrades.filter(
        (t) => t.variant === variant && t.result !== "PENDING"
      );

      if (variantTrades.length === 0) {
        res.json({ ok: true, variant, p5: [], p25: [], p50: [], p75: [], p95: [], original: [] });
        return;
      }

      const pips = variantTrades.map((t) => parseFloat(t.profit_pips ?? "0") || 0);
      const N = pips.length;

      // original equity curve
      let runningEquity = 0;
      const original = [0];
      for (const p of pips) {
        runningEquity += p;
        original.push(parseFloat(runningEquity.toFixed(4)));
      }

      // Monte Carlo bootstrap simulations (with replacement)
      // Store simulated equity values at each step.
      // Array size: (N + 1) * M
      const valuesAtStep = new Float32Array((N + 1) * M);

      for (let s = 0; s < M; s++) {
        let currentEquity = 0;
        for (let i = 1; i <= N; i++) {
          const randIdx = Math.floor(Math.random() * N);
          currentEquity += pips[randIdx];
          valuesAtStep[i * M + s] = currentEquity;
        }
      }

      const p5: number[] = [0];
      const p25: number[] = [0];
      const p50: number[] = [0];
      const p75: number[] = [0];
      const p95: number[] = [0];

      for (let i = 1; i <= N; i++) {
        const stepValues = valuesAtStep.subarray(i * M, (i + 1) * M);
        stepValues.sort();

        p5.push(parseFloat(stepValues[Math.floor(0.05 * M)].toFixed(4)));
        p25.push(parseFloat(stepValues[Math.floor(0.25 * M)].toFixed(4)));
        p50.push(parseFloat(stepValues[Math.floor(0.50 * M)].toFixed(4)));
        p75.push(parseFloat(stepValues[Math.floor(0.75 * M)].toFixed(4)));
        p95.push(parseFloat(stepValues[Math.floor(0.95 * M)].toFixed(4)));
      }

      res.json({
        ok: true,
        variant,
        p5,
        p25,
        p50,
        p75,
        p95,
        original,
      });
    } catch (err) {
      logger.error({ err, runId, variant }, "GET /montecarlo error");
      res.status(500).json({ ok: false, message: "Failed to perform Monte Carlo simulation" });
    }
  }
);

// ── RESEARCH DATABASE CRUD ENDPOINTS ──────────────────────────────────────────

// 1. GET /api/research/experiments — Lista y filtra investigaciones en la BD
researchRouter.get("/experiments", (req: Request, res: Response) => {
  try {
    const symbol          = typeof req.query.symbol === "string" ? req.query.symbol.toUpperCase().trim() : null;
    const strategy        = typeof req.query.strategy === "string" ? req.query.strategy.toLowerCase().trim() : null;
    const decision_status = typeof req.query.decision_status === "string" ? req.query.decision_status.toUpperCase().trim() : null;
    const tag             = typeof req.query.tag === "string" ? req.query.tag.trim() : null;
    const searchQuery     = typeof req.query.search === "string" ? req.query.search.trim() : null;
    const minPf           = parseFloat(typeof req.query.min_pf === "string" ? req.query.min_pf : "") || null;
    const minStab         = parseFloat(typeof req.query.min_stability === "string" ? req.query.min_stability : "") || null;

    const page  = Math.max(0, parseInt(typeof req.query.page === "string" ? req.query.page : "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(typeof req.query.limit === "string" ? req.query.limit : "20", 10) || 20));
    const offset = page * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (symbol) {
      conditions.push("symbol = ?");
      params.push(symbol);
    }
    if (strategy) {
      conditions.push("strategy = ?");
      params.push(strategy);
    }
    if (decision_status) {
      conditions.push("decision_status = ?");
      params.push(decision_status);
    }
    if (minPf !== null) {
      conditions.push("best_profit_factor >= ?");
      params.push(minPf);
    }
    if (minStab !== null) {
      conditions.push("best_stability_score >= ?");
      params.push(minStab);
    }
    if (tag) {
      conditions.push("tags LIKE ?");
      params.push(`%${tag}%`);
    }
    if (searchQuery) {
      conditions.push("(title LIKE ? OR hypothesis LIKE ? OR notes LIKE ? OR tags LIKE ?)");
      const p = `%${searchQuery}%`;
      params.push(p, p, p, p);
    }

    const whereStr = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const countRow = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM research_experiments ${whereStr}`,
      params
    );
    const total = countRow?.count ?? 0;

    const sql = `
      SELECT id, experiment_id, title, hypothesis, symbol, strategy, timeframe, bars_count,
             bot_version, git_commit, status, decision_status, decision_notes, tags, notes,
             best_variant, best_profit_factor, best_winrate, best_stability_score,
             best_max_drawdown, best_sharpe, created_at, updated_at
      FROM research_experiments
      ${whereStr}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = query<any>(sql, [...params, limit, offset]);

    const experiments = rows.map((r) => ({
      ...r,
      tags: typeof r.tags === "string" ? (tryParseJson(r.tags) ?? r.tags) : r.tags,
    }));

    res.json({
      ok: true,
      total,
      page,
      limit,
      experiments,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/research/experiments error");
    res.status(500).json({ ok: false, message: "Failed to query research database" });
  }
});

// 2. POST /api/research/experiments — Crea un registro de experimento reproducible
researchRouter.post("/experiments", (req: Request, res: Response) => {
  try {
    const {
      experiment_id,
      title,
      hypothesis,
      symbol,
      strategy,
      timeframe = "H1",
      bars_count = 20000,
      data_start_date,
      data_end_date,
      bot_version = "1.1.0",
      git_commit = "unknown",
      config = {},
      tags = [],
      notes = "",
      decision_status = "DRAFT",
      decision_notes = "",
      best_variant = "",
      best_profit_factor = 0.0,
      best_winrate = 0.0,
      best_stability_score = 0.0,
      best_max_drawdown = 0.0,
      best_sharpe = 0.0,
      metrics = {},
    } = req.body;

    if (!symbol || !strategy) {
      res.status(400).json({ ok: false, message: "Missing required fields: symbol and strategy" });
      return;
    }

    const expId = experiment_id || `exp_${Date.now()}`;
    const titleVal = title || `Investigación ${symbol} ${strategy}`;
    const configJson = typeof config === "string" ? config : JSON.stringify(config);
    const tagsJson   = typeof tags === "string" ? tags : JSON.stringify(tags);
    const metricsJson = typeof metrics === "string" ? metrics : JSON.stringify(metrics);

    run(
      `INSERT OR REPLACE INTO research_experiments (
        experiment_id, title, hypothesis, symbol, strategy, timeframe,
        bars_count, data_start_date, data_end_date, bot_version, git_commit,
        config_json, status, decision_status, decision_notes, tags, notes,
        best_variant, best_profit_factor, best_winrate, best_stability_score,
        best_max_drawdown, best_sharpe, metrics_json, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, 'COMPLETED', ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, datetime('now'), datetime('now')
      )`,
      [
        expId, titleVal, hypothesis || null, String(symbol).toUpperCase(), String(strategy).toLowerCase(), timeframe,
        Number(bars_count), data_start_date || null, data_end_date || null, bot_version, git_commit,
        configJson, decision_status.toUpperCase(), decision_notes || null, tagsJson, notes || null,
        best_variant || null, Number(best_profit_factor), Number(best_winrate), Number(best_stability_score),
        Number(best_max_drawdown), Number(best_sharpe), metricsJson
      ]
    );

    res.json({ ok: true, experiment_id: expId, message: "Experiment registered successfully in Research Database" });
  } catch (err) {
    logger.error({ err }, "POST /api/research/experiments error");
    res.status(500).json({ ok: false, message: "Failed to register experiment" });
  }
});

// 3. GET /api/research/experiments/:id — Obtiene ficha completa de una investigación
researchRouter.get("/experiments/:id", (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const row = queryOne<any>(
      `SELECT * FROM research_experiments WHERE experiment_id = ? OR id = ?`,
      [id, id]
    );

    if (!row) {
      res.status(404).json({ ok: false, message: "Experiment not found" });
      return;
    }

    res.json({
      ok: true,
      experiment: {
        ...row,
        config_json: tryParseJson(row.config_json) ?? row.config_json,
        metrics_json: tryParseJson(row.metrics_json) ?? row.metrics_json,
        tags: tryParseJson(row.tags) ?? row.tags,
        environment_meta: tryParseJson(row.environment_meta) ?? row.environment_meta,
      },
    });
  } catch (err) {
    logger.error({ err, id }, "GET /api/research/experiments/:id error");
    res.status(500).json({ ok: false, message: "Failed to retrieve experiment" });
  }
});

// 4. PATCH /api/research/experiments/:id — Actualiza dictamen, notas o hipótesis
researchRouter.patch("/experiments/:id", (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { title, hypothesis, decision_status, decision_notes, tags, notes, status } = req.body;

  try {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { setClauses.push("title = ?"); params.push(title); }
    if (hypothesis !== undefined) { setClauses.push("hypothesis = ?"); params.push(hypothesis); }
    if (decision_status !== undefined) { setClauses.push("decision_status = ?"); params.push(String(decision_status).toUpperCase()); }
    if (decision_notes !== undefined) { setClauses.push("decision_notes = ?"); params.push(decision_notes); }
    if (notes !== undefined) { setClauses.push("notes = ?"); params.push(notes); }
    if (status !== undefined) { setClauses.push("status = ?"); params.push(status); }
    if (tags !== undefined) {
      setClauses.push("tags = ?");
      params.push(typeof tags === "string" ? tags : JSON.stringify(tags));
    }

    if (setClauses.length === 0) {
      res.status(400).json({ ok: false, message: "No fields provided to update" });
      return;
    }

    setClauses.push("updated_at = datetime('now')");
    params.push(id, id);

    const result = run(
      `UPDATE research_experiments SET ${setClauses.join(", ")} WHERE experiment_id = ? OR id = ?`,
      params
    );

    if (result.changes === 0) {
      res.status(404).json({ ok: false, message: "Experiment not found" });
      return;
    }

    res.json({ ok: true, message: "Experiment updated successfully" });
  } catch (err) {
    logger.error({ err, id }, "PATCH /api/research/experiments/:id error");
    res.status(500).json({ ok: false, message: "Failed to update experiment" });
  }
});

// 5. GET /api/research/experiments/:id/reopen — Devuelve la carga útil reproducible
researchRouter.get("/experiments/:id/reopen", (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const row = queryOne<any>(
      `SELECT * FROM research_experiments WHERE experiment_id = ? OR id = ?`,
      [id, id]
    );

    if (!row) {
      res.status(404).json({ ok: false, message: "Experiment not found" });
      return;
    }

    const config = tryParseJson(row.config_json) ?? {};
    const tags   = tryParseJson(row.tags) ?? [];

    res.json({
      ok: true,
      reproducible_payload: {
        experiment_id: row.experiment_id,
        title: row.title,
        hypothesis: row.hypothesis,
        symbol: row.symbol,
        strategy: row.strategy,
        timeframe: row.timeframe,
        bars_count: row.bars_count,
        bot_version: row.bot_version,
        git_commit: row.git_commit,
        config,
        tags,
        notes: row.notes,
        decision_status: row.decision_status,
        reopened_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ err, id }, "GET /api/research/experiments/:id/reopen error");
    res.status(500).json({ ok: false, message: "Failed to fetch reopen payload" });
  }
});

// Helper interno
function tryParseJson(val: any): any {
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}
