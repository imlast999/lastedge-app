/**
 * Simple bearer-token middleware.
 *
 * The API_SECRET env var must be set on the server.
 * The mobile app sends:  Authorization: Bearer <token>
 *
 * If API_SECRET is not set, the middleware is DISABLED in development
 * and BLOCKS all requests in production (fail-safe).
 */
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

const SECRET = process.env.API_SECRET;
const IS_PROD = process.env.NODE_ENV === "production";

if (!SECRET) {
  if (IS_PROD) {
    logger.error(
      "API_SECRET is not set. All /api requests will be rejected in production."
    );
  } else {
    logger.warn(
      "API_SECRET is not set. Auth is DISABLED — set it before deploying."
    );
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // No secret configured in dev → skip auth
  if (!SECRET) {
    if (!IS_PROD) {
      next();
      return;
    }
    res.status(503).json({ error: "Server misconfigured: API_SECRET not set." });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  let token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    const xKey = req.headers["x-api-key"];
    if (typeof xKey === "string") token = xKey.trim();
  }
  if (!token) {
    const q = req.query["token"];
    if (typeof q === "string") token = q.trim();
  }

  if (!token || token !== SECRET) {
    res.status(401).json({
      error: "Unauthorized",
      hint: "Envía Authorization: Bearer <API_SECRET>, header X-Api-Key, o ?token= en la URL",
    });
    return;
  }

  next();
}
