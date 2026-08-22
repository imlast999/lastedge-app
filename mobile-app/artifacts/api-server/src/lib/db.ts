/**
 * Lightweight SQLite reader for bot_state.db.
 *
 * We use the built-in `node:sqlite` module (Node 22+).
 * For Node < 22 we fall back to a synchronous open via better-sqlite3
 * (listed as an optional peer).  We keep this file free of Drizzle so
 * the server can run without the workspace lib/db package.
 */
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 15; i++) {
    if (
      fs.existsSync(path.join(dir, "start_all.bat")) ||
      fs.existsSync(path.join(dir, "bot.py")) ||
      fs.existsSync(path.join(dir, "requirements.txt"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir, "..", "..", "..", "..");
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(currentDir);

// ── Resolve path to bot_state.db ─────────────────────────────────────────────
// Default: same directory as this repo root (c:\LastEdge\bot_state.db)
// Override with env var: BOT_DB_PATH=/absolute/path/to/bot_state.db
const DEFAULT_DB_PATH = process.env.BOT_DB_PATH
  ? path.resolve(process.env.BOT_DB_PATH)
  : path.join(repoRoot, "bot_state.db");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DEFAULT_DB_PATH, { open: true });
    ensureSchema(_db);
  }
  return _db;
}

/** Migraciones mínimas para tablas que usa la API móvil. */
export function ensureSchema(db: DatabaseSync = getDb()): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS backtest_tasks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol          TEXT    NOT NULL,
      strategy        TEXT    NOT NULL,
      bars            INTEGER NOT NULL,
      cb_losses       INTEGER DEFAULT 4,
      cb_pause        INTEGER DEFAULT 168,
      status          TEXT    NOT NULL DEFAULT 'PENDING',
      results_json    TEXT,
      error_message   TEXT,
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS research_experiments (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id           TEXT UNIQUE NOT NULL,
      title                   TEXT NOT NULL,
      hypothesis              TEXT,
      symbol                  TEXT NOT NULL,
      strategy                TEXT NOT NULL,
      timeframe               TEXT DEFAULT 'H1',
      bars_count              INTEGER DEFAULT 20000,
      data_start_date         TEXT,
      data_end_date           TEXT,
      bot_version             TEXT DEFAULT '1.1.0',
      git_commit              TEXT,
      environment_meta        TEXT,
      config_json             TEXT NOT NULL,
      status                  TEXT NOT NULL DEFAULT 'COMPLETED',
      decision_status         TEXT DEFAULT 'DRAFT',
      decision_notes          TEXT,
      tags                    TEXT,
      notes                   TEXT,
      best_variant            TEXT,
      best_profit_factor      REAL,
      best_winrate            REAL,
      best_stability_score    REAL,
      best_max_drawdown       REAL,
      best_sharpe             REAL,
      best_sortino            REAL,
      best_calmar             REAL,
      best_mc_ruin_pct        REAL,
      wf_stability            REAL,
      metrics_json            TEXT,
      artifacts_path          TEXT,
      created_at              TEXT DEFAULT (datetime('now')),
      updated_at              TEXT DEFAULT (datetime('now'))
    );
  `);
}

/** Run a SELECT and return all rows as plain objects. */
export function query<T = Record<string, unknown>>(
  sql: string,
  params: SQLInputValue[] = []
): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

/** Run a SELECT that returns a single row (or null). */
export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: SQLInputValue[] = []
): T | null {
  const db = getDb();
  const stmt = db.prepare(sql);
  return (stmt.get(...params) as T) ?? null;
}

/** Run an INSERT/UPDATE/DELETE. Returns { changes, lastInsertRowid }. */
export function run(
  sql: string,
  params: SQLInputValue[] = []
): { changes: number; lastInsertRowid: number | bigint } {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.run(...params) as { changes: number; lastInsertRowid: number | bigint };
}
