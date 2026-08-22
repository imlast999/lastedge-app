import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "@bot_mt5_settings_v2";

export const POLL_INTERVAL_OPTIONS = [
  { label: "3 s", value: 3000 },
  { label: "5 s", value: 5000 },
  { label: "10 s", value: 10000 },
  { label: "30 s", value: 30000 },
] as const;

export interface AppSettings {
  autoRefresh: boolean;
  pollIntervalMs: number;
  notificationsEnabled: boolean;
  notifyNewSignals: boolean;
  notifyTradeClose: boolean;
  notifyDisconnect: boolean;
  hapticsEnabled: boolean;
  /** Vacío = usar URL del APK */
  serverUrl: string;
  /** Vacío = usar token del APK */
  serverToken: string;
  /** Idioma de la app: 'en' | 'es' */
  language: "en" | "es";
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoRefresh: true,
  pollIntervalMs: 5000,
  notificationsEnabled: true,
  notifyNewSignals: true,
  notifyTradeClose: true,
  notifyDisconnect: true,
  hapticsEnabled: true,
  serverUrl: "",
  serverToken: "",
  language: "en",
};

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => Promise<void>;
  shouldNotify: (category: "NEW_SIGNAL" | "TRADE_CLOSE" | "CRITICAL_ERROR") => boolean;
  apiOverrides: { url: string; token: string };
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppSettings>;
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
          return;
        }
        return AsyncStorage.getItem("@bot_mt5_settings_v1").then((legacy) => {
          if (legacy) {
            const parsed = JSON.parse(legacy) as Partial<AppSettings>;
            setSettings({ ...DEFAULT_SETTINGS, ...parsed });
          }
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback(async (next: AppSettings) => {
    setSettings(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore write errors
    }
  }, []);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  }, []);

  const shouldNotify = useCallback(
    (category: "NEW_SIGNAL" | "TRADE_CLOSE" | "CRITICAL_ERROR") => {
      if (!settings.notificationsEnabled) return false;
      switch (category) {
        case "NEW_SIGNAL":
          return settings.notifyNewSignals;
        case "TRADE_CLOSE":
          return settings.notifyTradeClose;
        case "CRITICAL_ERROR":
          return settings.notifyDisconnect;
        default:
          return true;
      }
    },
    [settings]
  );

  const apiOverrides = useMemo(
    () => ({ url: settings.serverUrl, token: settings.serverToken }),
    [settings.serverUrl, settings.serverToken]
  );

  const value = useMemo(
    () => ({
      settings,
      loaded,
      updateSetting,
      resetSettings,
      shouldNotify,
      apiOverrides,
    }),
    [settings, loaded, updateSetting, resetSettings, shouldNotify, apiOverrides]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
