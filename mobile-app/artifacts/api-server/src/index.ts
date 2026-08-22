import app from "./app.js";
import { logger } from "./lib/logger.js";

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  logger.info(
    { dbPath: process.env.BOT_DB_PATH ?? "(auto-resolved)" },
    "Connected to bot_state.db"
  );
});

process.on("SIGINT", () => {
  logger.info("🛑 [Ctrl+C] Interrupción recibida. Cerrando API Server de forma limpia...");
  server.close(() => {
    logger.info("✅ API Server cerrado exitosamente.");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 500).unref();
});

process.on("SIGTERM", () => {
  logger.info("🛑 [SIGTERM] Señal de terminación recibida. Cerrando API Server...");
  server.close(() => {
    logger.info("✅ API Server cerrado exitosamente.");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 500).unref();
});
