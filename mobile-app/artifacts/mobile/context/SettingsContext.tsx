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
const ECOSYSTEM_STORAGE_KEY = "@lastedge_ecosystem_modules_v1";

export const POLL_INTERVAL_OPTIONS = [
  { label: "3 s", value: 3000 },
  { label: "5 s", value: 5000 },
  { label: "10 s", value: 10000 },
  { label: "30 s", value: 30000 },
] as const;

export interface EcosystemModules {
  tradingEngine: boolean;
  strategyLab: boolean;
}

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
  /** Ecosistema LastEdge: partes activas */
  ecosystemModules: EcosystemModules;
  /** Si el wizard inicial de ecosistema ya fue completado */
  ecosystemSetupCompleted: boolean;
}

export const DEFAULT_ECOSYSTEM_MODULES: EcosystemModules = {
  tradingEngine: true,
  strategyLab: true,
};

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
  ecosystemModules: DEFAULT_ECOSYSTEM_MODULES,
  ecosystemSetupCompleted: false,
};

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateEcosystemModules: (modules: EcosystemModules) => Promise<boolean>;
  resetSettings: () => Promise<void>;
  shouldNotify: (category: "NEW_SIGNAL" | "TRADE_CLOSE" | "CRITICAL_ERROR") => boolean;
  apiOverrides: { url: string; token: string };
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(ECOSYSTEM_STORAGE_KEY),
    ])
      .then(([rawSettings, rawEco]) => {
        let loadedSettings: AppSettings = { ...DEFAULT_SETTINGS };

        if (rawSettings) {
          try {
            const parsed = JSON.parse(rawSettings) as Partial<AppSettings>;
            loadedSettings = { ...loadedSettings, ...parsed };
          } catch {}
        } else {
          // Check legacy
          AsyncStorage.getItem("@bot_mt5_settings_v1").then((legacy) => {
            if (legacy) {
              try {
                const parsed = JSON.parse(legacy) as Partial<AppSettings>;
                setSettings((prev) => ({ ...prev, ...parsed }));
              } catch {}
            }
          }).catch(() => {});
        }

        if (rawEco) {
          try {
            const parsedEco = JSON.parse(rawEco) as Partial<EcosystemModules>;
            if (parsedEco.tradingEngine !== undefined || parsedEco.strategyLab !== undefined) {
              loadedSettings.ecosystemModules = {
                tradingEngine: parsedEco.tradingEngine !== false,
                strategyLab: parsedEco.strategyLab !== false,
              };
              loadedSettings.ecosystemSetupCompleted = true;
            }
          } catch {}
        } else if (loadedSettings.ecosystemSetupCompleted) {
          // Sync dedicated key
          AsyncStorage.setItem(ECOSYSTEM_STORAGE_KEY, JSON.stringify(loadedSettings.ecosystemModules)).catch(() => {});
        }

        // Enforce invariant: at least 1 must be true
        if (
          !loadedSettings.ecosystemModules.tradingEngine &&
          !loadedSettings.ecosystemModules.strategyLab
        ) {
          loadedSettings.ecosystemModules = { tradingEngine: true, strategyLab: true };
        }

        setSettings(loadedSettings);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
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

  const updateEcosystemModules = useCallback(
    async (modules: EcosystemModules) => {
      // Invariant: at least 1 module must be active
      if (!modules.tradingEngine && !modules.strategyLab) {
        return false;
      }
      setSettings((prev) => {
        const next: AppSettings = {
          ...prev,
          ecosystemModules: modules,
          ecosystemSetupCompleted: true,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        AsyncStorage.setItem(ECOSYSTEM_STORAGE_KEY, JSON.stringify(modules)).catch(() => {});
        return next;
      });
      return true;
    },
    []
  );

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    await AsyncStorage.removeItem(ECOSYSTEM_STORAGE_KEY);
  }, []);

  const shouldNotify = useCallback(
    (category: "NEW_SIGNAL" | "TRADE_CLOSE" | "CRITICAL_ERROR") => {
      if (!settings.notificationsEnabled) return false;
      // If trading engine is disabled, suppress MT5 notifications
      if (settings.ecosystemModules && !settings.ecosystemModules.tradingEngine) {
        return false;
      }
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
      updateEcosystemModules,
      resetSettings,
      shouldNotify,
      apiOverrides,
    }),
    [settings, loaded, updateSetting, updateEcosystemModules, resetSettings, shouldNotify, apiOverrides]
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
