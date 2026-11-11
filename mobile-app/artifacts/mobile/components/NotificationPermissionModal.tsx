import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/context/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { registerForPushNotificationsAsync } from "@/services/notifications";
import { TOUR_STORAGE_KEY } from "./AppTourModal";

export const NOTIF_PROMPT_STORAGE_KEY = "@lastedge_notif_prompted_v1";

export function NotificationPermissionModal() {
  const { settings, loaded } = useSettings();
  const colors = useColors();
  const isEs = settings?.language === "es";

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkPermissionStatus() {
      if (Platform.OS === "web") return;
      try {
        const [prompted, tourDone] = await Promise.all([
          AsyncStorage.getItem(NOTIF_PROMPT_STORAGE_KEY),
          AsyncStorage.getItem(TOUR_STORAGE_KEY),
        ]);

        // Only show if tour is done and permission prompt has not been displayed yet
        if (tourDone === "true" && prompted !== "true") {
          if (mounted) setVisible(true);
        }
      } catch {
        // Fallback
      }
    }

    checkPermissionStatus();
    const interval = setInterval(checkPermissionStatus, 1500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleAccept = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await AsyncStorage.setItem(NOTIF_PROMPT_STORAGE_KEY, "true");
    setVisible(false);
    await registerForPushNotificationsAsync();
  };

  const handleDismiss = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await AsyncStorage.setItem(NOTIF_PROMPT_STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!loaded || !visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card || "#0D111A", borderColor: colors.border }]}>
          {/* Ambient Glow */}
          <View style={styles.ambientGlow} />

          {/* Icon Badge */}
          <View style={styles.iconCircle}>
            <Feather name="bell" size={28} color="#10B981" />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>
            {isEs ? "Alertas Institucionales en Vivo" : "Live Institutional Alerts"}
          </Text>
          <Text style={styles.subtitle}>
            {isEs
              ? "Mantente informado instantáneamente en tu teléfono sobre eventos críticos de trading:"
              : "Stay instantly informed on your phone about critical trading telemetry:"}
          </Text>

          {/* Feature List */}
          <View style={styles.featuresList}>
            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
              <Text style={styles.featureText}>
                {isEs
                  ? "Ratchet Trailing Stop & Break-Even asegurado"
                  : "Ratchet Trailing Stop & Break-Even protected"}
              </Text>
            </View>

            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="lightning-bolt" size={16} color="#F59E0B" />
              <Text style={styles.featureText}>
                {isEs
                  ? "Nuevas señales algorítmicas de alta confluencia"
                  : "High-confluence algorithmic trade signals"}
              </Text>
            </View>

            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="alert-octagon" size={16} color="#EF4444" />
              <Text style={styles.featureText}>
                {isEs
                  ? "Salvaguardas de riesgo y Circuit Breaker de emergencia"
                  : "Risk shields & emergency Circuit Breaker alerts"}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleDismiss}
              style={styles.laterButton}
            >
              <Text style={styles.laterButtonText}>
                {isEs ? "Ahora no" : "Maybe Later"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAccept}
              style={styles.enableButton}
            >
              <Text style={styles.enableButtonText}>
                {isEs ? "Activar Notificaciones" : "Enable Alerts"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
  },
  ambientGlow: {
    position: "absolute",
    top: -40,
    width: 200,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 18,
  },
  featuresList: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  laterButton: {
    flex: 0.4,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  laterButtonText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  enableButton: {
    flex: 0.6,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
  },
  enableButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
