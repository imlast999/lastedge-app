import pino from "pino";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isProduction = process.env.NODE_ENV === "production";

// ── Helper to resolve repo root ───────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  return path.resolve(startDir, "..", "..", "..", "..");
}

const repoRoot = findRepoRoot(__dirname);

// Ensure local API server logs directory exists (mobile-app/artifacts/logs)
const localLogsDir = path.resolve(__dirname, "../../logs");

try {
  if (!fs.existsSync(localLogsDir)) {
    fs.mkdirSync(localLogsDir, { recursive: true });
  }
} catch (e) {
  console.error("⚠️ Could not create logs directory:", e);
}

// ── Generate Timestamped .txt Log File ───────────────────────────────────────
const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const timestampFileStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
const logFileName = `api_logs_${timestampFileStr}.txt`;

export const currentLogFilePath = path.join(localLogsDir, logFileName);

// Initialize .txt log file with session header
const startTimeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
const header = [
  `=== LastEdge API Server STARTED: ${startTimeStr} ===`,
  `=== LOG FILE: ${logFileName} ===`,
  "=".repeat(60),
  "",
].join("\n");

try {
  fs.writeFileSync(currentLogFilePath, header, "utf-8");
} catch (err) {
  console.error(`Failed to initialize log file at ${currentLogFilePath}:`, err);
}

// ── Process Exit Hook ─────────────────────────────────────────────────────────
process.on("exit", () => {
  try {
    const endNow = new Date();
    const endTimeStr = `${endNow.getFullYear()}-${pad(endNow.getMonth() + 1)}-${pad(endNow.getDate())} ${pad(endNow.getHours())}:${pad(endNow.getMinutes())}:${pad(endNow.getSeconds())}`;
    const footer = [
      "",
      "=".repeat(60),
      `=== LastEdge API Server CLOSED: ${endTimeStr} ===`,
      "=".repeat(60),
      "",
    ].join("\n");
    fs.appendFileSync(currentLogFilePath, footer, "utf-8");
  } catch {
    // Ignore on exit
  }
});

// ── Append Line Helper ────────────────────────────────────────────────────────
function appendToFile(level: string, msg: string, meta?: any) {
  try {
    const timeNow = new Date();
    const timeStr = `${pad(timeNow.getHours())}:${pad(timeNow.getMinutes())}:${pad(timeNow.getSeconds())}`;
    let line = `[${timeStr}] [${level.toUpperCase()}] ${msg}`;

    if (meta) {
      if (meta instanceof Error) {
        line += `\n  Error: ${meta.message}\n  Stack: ${meta.stack}`;
      } else if (typeof meta === "object") {
        try {
          line += ` | ${JSON.stringify(meta)}`;
        } catch {
          line += ` | [Object]`;
        }
      } else {
        line += ` | ${meta}`;
      }
    }

    fs.appendFileSync(currentLogFilePath, line + "\n", "utf-8");
  } catch (err) {
    // Ignore file write error fallback
  }
}

// ── Base Pino Logger ──────────────────────────────────────────────────────────
export const pinoInstance = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(!isProduction && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

// ── Consolidated API Server Logger Interface ─────────────────────────────────
export const logger = {
  info(msg: string | object, ...args: any[]) {
    if (typeof msg === "string") {
      pinoInstance.info(msg, ...args);
      appendToFile("INFO", msg, args[0]);
    } else {
      pinoInstance.info(msg, ...args);
      appendToFile("INFO", args[0] || "Event", msg);
    }
  },
  warn(msg: string | object, ...args: any[]) {
    if (typeof msg === "string") {
      pinoInstance.warn(msg, ...args);
      appendToFile("WARN", msg, args[0]);
    } else {
      pinoInstance.warn(msg, ...args);
      appendToFile("WARN", args[0] || "Warning", msg);
    }
  },
  error(msg: string | object, ...args: any[]) {
    if (typeof msg === "string") {
      pinoInstance.error(msg, ...args);
      appendToFile("ERROR", msg, args[0]);
    } else {
      pinoInstance.error(msg, ...args);
      appendToFile("ERROR", args[0] || "Error", msg);
    }
  },
  debug(msg: string | object, ...args: any[]) {
    if (typeof msg === "string") {
      pinoInstance.debug(msg, ...args);
      appendToFile("DEBUG", msg, args[0]);
    } else {
      pinoInstance.debug(msg, ...args);
      appendToFile("DEBUG", args[0] || "Debug", msg);
    }
  },
  logFilePath: currentLogFilePath,
};


