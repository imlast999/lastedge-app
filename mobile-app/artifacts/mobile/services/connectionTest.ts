import { resolveApiConfig } from "@/lib/apiConfig";
import type { BotStatus } from "@/context/TradingContext";

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  status?: BotStatus;
  healthOk: boolean;
  error?: string;
}

export async function testServerConnection(
  overrides?: { url?: string; token?: string }
): Promise<ConnectionTestResult> {
  const { url: baseUrl, token } = resolveApiConfig(overrides);
  if (!baseUrl) {
    return { ok: false, latencyMs: 0, healthOk: false, error: "URL del servidor no configurada" };
  }

  const start = Date.now();
  let healthOk = false;
  let status: BotStatus | undefined;
  let error: string | undefined;

  try {
    const healthRes = await fetch(`${baseUrl}/api/healthz`, { method: "GET" });
    healthOk = healthRes.ok;
    if (!healthRes.ok) error = `healthz → HTTP ${healthRes.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    return { ok: false, latencyMs: Date.now() - start, healthOk: false, error };
  }

  try {
    const secret = token;
    const statusRes = await fetch(`${baseUrl}/api/status`, {
      headers: secret
        ? { Authorization: `Bearer ${secret}`, "X-Api-Key": secret }
        : {},
    });
    if (statusRes.ok) {
      status = (await statusRes.json()) as BotStatus;
    } else if (!error) {
      error = `status → HTTP ${statusRes.status}`;
    }
  } catch (e) {
    if (!error) error = e instanceof Error ? e.message : String(e);
  }

  const latencyMs = Date.now() - start;
  return {
    ok: healthOk && !!status,
    latencyMs,
    status,
    healthOk,
    error: status ? undefined : error,
  };
}
