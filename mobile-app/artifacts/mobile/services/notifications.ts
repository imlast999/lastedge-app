import * as Notifications from "expo-notifications";
import { Platform, Linking } from "react-native";
import { router } from "expo-router";

export type NotificationCategory =
  | "DISCRETIONARY_SIGNAL"  // 1.1 Nueva señal discrecional (TTL 10m)
  | "AUTO_SIGNAL"           // 1.2 Señal auto-ejecutada (>= 0.67)
  | "EXPIRED_SIGNAL"        // 1.3 Alerta señal expirada por tiempo
  | "BREAK_EVEN"            // 2.1 Trailing stop / Break-Even asegurado
  | "PARTIAL_TP"            // 2.2 Take profit parcial ejecutado (50%)
  | "TRADE_PROFIT"          // 2.3 Cierre en ganancia
  | "TRADE_LOSS"            // 2.4 Cierre en stop loss
  | "WEEKEND_GUARD_PRE"     // 3.1 Aviso previo Weekend Guard (viernes)
  | "WEEKEND_GUARD_EXEC"    // 3.2 Confirmación liquidación fin de semana
  | "CIRCUIT_BREAKER"       // 3.4 Activación de Circuit Breaker
  | "BACKTEST_COMPLETE"     // 4.2 Fin de optimización / backtest Lab
  | "DISCONNECT"            // 5.1 Pérdida/recuperación conexión MT5
  | "SPREAD_SPIKE"          // 5.2 Alerta de spread anormal (>4 pips)
  | "DAILY_WRAPUP"          // 6.1 Resumen diario de sesión (22:00 UTC)
  | "APP_UPDATE"            // 6.2 Nueva versión del APK disponible
  // Compatibilidad hacia atrás
  | "CRITICAL_ERROR"
  | "NEW_SIGNAL"
  | "TRADE_CLOSE";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const category = notification.request.content.data?.category as NotificationCategory | undefined;
    const isCritical =
      category === "CRITICAL_ERROR" ||
      category === "DISCONNECT" ||
      category === "CIRCUIT_BREAKER" ||
      category === "WEEKEND_GUARD_EXEC";

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permission not granted");
    return null;
  }

  if (Platform.OS === "android") {
    // 1. Canal Crítico (Desconexión MT5, Circuit Breakers, Cierre Forzado)
    await Notifications.setNotificationChannelAsync("critical", {
      name: "Critical & Risk Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: "#ef4444",
      sound: "default",
    });

    // 2. Canal de Señales (Discrecionales, Auto-ejecutadas, Expiradas)
    await Notifications.setNotificationChannelAsync("signals", {
      name: "Trading Signals & Execution",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#22c55e",
      sound: "default",
    });

    // 3. Canal de Posiciones (Break-Even, Parciales, TP, SL)
    await Notifications.setNotificationChannelAsync("trades", {
      name: "Trade Lifecycle & Profits",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150],
      lightColor: "#3b82f6",
      sound: "default",
    });

    // 4. Canal de Salvaguardas (Aviso Weekend Guard, Spreads)
    await Notifications.setNotificationChannelAsync("risk", {
      name: "Risk Safeguards & Warnings",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200],
      lightColor: "#f59e0b",
      sound: "default",
    });

    // 5. Canal de Sistema y Lab (Backtests, Resumen Diario, Actualizaciones APK)
    await Notifications.setNotificationChannelAsync("system", {
      name: "System, Lab & Daily Routine",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#8b5cf6",
      sound: "default",
    });
  }

  try {
    const Constants = require("expo-constants").default;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      return null;
    }
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch (err) {
    return null;
  }
}

export function setupNotificationListeners(
  onNotification?: (notification: Notifications.Notification) => void
) {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    onNotification?.(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    const category = data?.category as NotificationCategory | undefined;

    switch (category) {
      case "DISCRETIONARY_SIGNAL":
      case "AUTO_SIGNAL":
      case "EXPIRED_SIGNAL":
      case "NEW_SIGNAL":
        router.push("/(tabs)/trades");
        break;

      case "BREAK_EVEN":
      case "PARTIAL_TP":
      case "TRADE_PROFIT":
      case "TRADE_LOSS":
      case "TRADE_CLOSE":
        router.push("/(tabs)/trades");
        break;

      case "BACKTEST_COMPLETE":
        router.push("/(tabs)/lab");
        break;

      case "APP_UPDATE":
        const url = (data?.url as string) || "https://github.com/imlast999/lastedge-app/releases/latest";
        Linking.openURL(url).catch(() => {});
        break;

      case "WEEKEND_GUARD_PRE":
      case "WEEKEND_GUARD_EXEC":
      case "CIRCUIT_BREAKER":
      case "DISCONNECT":
      case "CRITICAL_ERROR":
      case "SPREAD_SPIKE":
      case "DAILY_WRAPUP":
      default:
        router.push("/(tabs)");
        break;
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export function getChannelForCategory(category: NotificationCategory): string {
  switch (category) {
    case "CRITICAL_ERROR":
    case "DISCONNECT":
    case "CIRCUIT_BREAKER":
    case "WEEKEND_GUARD_EXEC":
      return "critical";

    case "DISCRETIONARY_SIGNAL":
    case "AUTO_SIGNAL":
    case "EXPIRED_SIGNAL":
    case "NEW_SIGNAL":
      return "signals";

    case "BREAK_EVEN":
    case "PARTIAL_TP":
    case "TRADE_PROFIT":
    case "TRADE_LOSS":
    case "TRADE_CLOSE":
      return "trades";

    case "WEEKEND_GUARD_PRE":
    case "SPREAD_SPIKE":
      return "risk";

    case "BACKTEST_COMPLETE":
    case "DAILY_WRAPUP":
    case "APP_UPDATE":
    default:
      return "system";
  }
}

export async function sendLocalNotification(
  category: NotificationCategory,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const channelId = getChannelForCategory(category);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { category, ...data },
      ...(Platform.OS === "android" && { channelId }),
    },
    trigger: null,
  });
}
