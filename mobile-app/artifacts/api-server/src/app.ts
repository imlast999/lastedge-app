import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger, pinoInstance } from "./lib/logger.js";
import routes from "./routes/index.js";

const app = express();

// ── Pino Logging Middleware ───────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger: pinoInstance,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

// ── Custom Request & IP Logger ────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logLine = `${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms) | IP: ${clientIp}`;
    if (res.statusCode >= 500) {
      logger.error(`❌ [HTTP ${res.statusCode}] ${logLine}`);
    } else if (res.statusCode >= 400) {
      logger.warn(`⚠️ [HTTP ${res.statusCode}] ${logLine}`);
    } else {
      logger.info(`🌐 ${logLine}`);
    }
  });

  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
// Restrict to origins listed in ALLOWED_ORIGINS (comma-separated).
// If the env var is not set, fall back to open CORS only in development.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const IS_PROD = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: allowedOrigins.length > 0
      ? allowedOrigins
      : IS_PROD
        ? false          // block all cross-origin in prod if not configured
        : "*",           // allow all in dev for convenience
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", routes);

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const errMessage = err?.message || String(err);
  const errStack = err?.stack || "No stack trace available";

  logger.error(
    `❌ [500 INTERNAL SERVER ERROR] ${req.method} ${req.originalUrl} | Client IP: ${clientIp}\n` +
    `  Error: ${errMessage}\n` +
    `  Stack: ${errStack}`
  );

  if (!res.headersSent) {
    res.status(500).json({
      ok: false,
      error: "Internal Server Error",
      message: errMessage,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
});

export default app;

