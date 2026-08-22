import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";

export type NotificationCategory = "CRITICAL_ERROR" | "NEW_SIGNAL" | "TRADE_CLOSE";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const category = notification.request.content.data?.category as NotificationCategory | undefined;
    return {
      shouldShowAlert: true,
      shouldPlaySound: category === "CRITICAL_ERROR",
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
    await Notifications.setNotificationChannelAsync("critical", {
      name: "Critical Errors",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f87171",
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("signals", {
      name: "New Signals",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150],
      lightColor: "#4ade80",
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("trades", {
      name: "Trade Closes",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#60a5fa",
      sound: "default",
    });
  }

  try {
    // Note: getExpoPushTokenAsync requires a valid EAS projectId.
    // If not configured, it returns null gracefully.
    const Constants = require("expo-constants").default;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn("[Notifications] No EAS projectId found. Push tokens disabled.");
      return null;
    }
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch (err) {
    console.warn("[Notifications] Push token registration failed:", err);
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

    if (category === "NEW_SIGNAL") {
      router.push("/(tabs)/signals");
    } else if (category === "TRADE_CLOSE") {
      router.push("/(tabs)/history");
    } else if (category === "CRITICAL_ERROR") {
      router.push("/(tabs)");
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export async function sendLocalNotification(
  category: NotificationCategory,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { category, ...data },
      ...(Platform.OS === "android" && {
        channelId:
          category === "CRITICAL_ERROR"
            ? "critical"
            : category === "NEW_SIGNAL"
            ? "signals"
            : "trades",
      }),
    },
    trigger: null,
  });
}
