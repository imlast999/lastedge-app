import Constants from "expo-constants";

function readBuildEnv(key: "apiUrl" | "apiSecret"): string {
  if (key === "apiUrl") {
    return (
      process.env.EXPO_PUBLIC_API_URL ??
      (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
      ""
    );
  }
  return (
    process.env.EXPO_PUBLIC_API_SECRET ??
    (Constants.expoConfig?.extra?.apiSecret as string | undefined) ??
    ""
  );
}

/** URL/token embebidos en el APK (valores por defecto). */
export function getBuildApiUrl(): string {
  return readBuildEnv("apiUrl").replace(/\/$/, "");
}

export function getBuildApiSecret(): string {
  return readBuildEnv("apiSecret");
}

/** URL/token efectivos: override de Ajustes > valores del build. */
export function resolveApiConfig(overrides?: { url?: string; token?: string }) {
  const url = (overrides?.url?.trim() || getBuildApiUrl()).replace(/\/$/, "");
  const token = overrides?.token?.trim() || getBuildApiSecret();
  return { url, token };
}

export function getApiUrl(): string {
  return getBuildApiUrl();
}

export function getApiSecret(): string {
  return getBuildApiSecret();
}

export function hasApiSecret(overrides?: { token?: string }): boolean {
  return resolveApiConfig(overrides).token.length > 0;
}

export function maskSecret(secret: string): string {
  if (!secret) return "—";
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "1.0.0";
}
