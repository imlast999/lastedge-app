import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { DISCLAIMER_STORAGE_KEY } from "./EcosystemDisclaimerModal";

export function EcosystemOnboardingModal() {
  const { settings, loaded, updateEcosystemModules } = useSettings();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [engineActive, setEngineActive] = useState(true);
  const [labActive, setLabActive] = useState(true);
  const [showError, setShowError] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const val = await AsyncStorage.getItem(DISCLAIMER_STORAGE_KEY);
        if (mounted) setDisclaimerAccepted(val === "true");
      } catch {
        if (mounted) setDisclaimerAccepted(true);
      }
    }
    check();
    const interval = setInterval(check, 350);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // If not loaded yet, or if already completed, or if disclaimer is not yet accepted, do not show
  if (!loaded || settings.ecosystemSetupCompleted || !disclaimerAccepted) {
    return null;
  }

  const selectedCount = (engineActive ? 1 : 0) + (labActive ? 1 : 0);

  const toggleEngine = () => {
    if (engineActive && !labActive) {
      setShowError(true);
      return;
    }
    setShowError(false);
    setEngineActive((prev) => !prev);
  };

  const toggleLab = () => {
    if (labActive && !engineActive) {
      setShowError(true);
      return;
    }
    setShowError(false);
    setLabActive((prev) => !prev);
  };

  const handleConfirm = async () => {
    if (selectedCount < 1) {
      setShowError(true);
      return;
    }
    await updateEcosystemModules({
      tradingEngine: engineActive,
      strategyLab: labActive,
    });
  };

  const isEs = settings.language === "es";

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.dialogContainer,
            {
              backgroundColor: colors.card || "#12141A",
              borderColor: colors.border || "#27272A",
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 24),
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Badge */}
            <View style={styles.badgeWrapper}>
              <View style={[styles.badgeTag, { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
                <Feather name="layers" size={12} color="#10B981" />
                <Text style={styles.badgeText}>
                  {isEs ? "ECOSISTEMA LASTEDGE" : "LASTEDGE ECOSYSTEM"}
                </Text>
              </View>
            </View>

            {/* Title & Explanatory Prompt */}
            <Text style={[styles.title, { color: colors.foreground || "#FFFFFF" }]}>
              {isEs ? "Configuración de Servicios" : "Service Configuration"}
            </Text>
            <Text style={[styles.description, { color: colors.mutedForeground || "#94A3B8" }]}>
              {isEs ? (
                <>
                  Esta app es parte del ecosistema{" "}
                  <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>LastEdge</Text>. Si no
                  tienes alguno de estos servicios, esta app no tendrá ningún uso real.
                </>
              ) : (
                <>
                  This app is part of the{" "}
                  <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>LastEdge</Text> ecosystem.
                  If you do not run at least one of these services, this app will have no real utility.
                </>
              )}
            </Text>
            <Text style={[styles.question, { color: colors.foreground || "#F1F5F9" }]}>
              {isEs ? "¿Qué partes del ecosistema tienes activas?" : "Which parts of the ecosystem do you have active?"}
            </Text>

            {/* Selection Cards */}
            <View style={styles.cardsContainer}>
              {/* Option 1: Trading Engine */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={toggleEngine}
                style={[
                  styles.moduleCard,
                  {
                    backgroundColor: engineActive
                      ? "rgba(14, 165, 233, 0.08)"
                      : "rgba(255, 255, 255, 0.02)",
                    borderColor: engineActive ? "#0EA5E9" : colors.border || "#27272A",
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardIconBox, { backgroundColor: "rgba(14, 165, 233, 0.15)", borderColor: "rgba(14, 165, 233, 0.3)" }]}>
                    <Feather name="zap" size={18} color="#38BDF8" />
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: engineActive ? "#0EA5E9" : "transparent",
                        borderColor: engineActive ? "#0EA5E9" : "#475569",
                      },
                    ]}
                  >
                    {engineActive && <Feather name="check" size={13} color="#FFFFFF" />}
                  </View>
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground || "#FFFFFF" }]}>
                  Trading Engine
                </Text>
                <Text style={styles.cardPort}>
                  {isEs ? "MetaTrader 5 · Puerto 8081" : "MetaTrader 5 · Port 8081"}
                </Text>
                <Text style={[styles.cardText, { color: colors.mutedForeground || "#94A3B8" }]}>
                  {isEs
                    ? "Ejecución autónoma o híbrida de órdenes en vivo en MT5, trailing stops en tiempo real, gestión de riesgo institucional y monitor de posiciones abiertas."
                    : "Autonomous or hybrid live MT5 order execution, real-time trailing stops, institutional risk management, and live open positions telemetry."}
                </Text>
              </TouchableOpacity>

              {/* Option 2: Strategy Lab */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={toggleLab}
                style={[
                  styles.moduleCard,
                  {
                    backgroundColor: labActive
                      ? "rgba(168, 85, 247, 0.08)"
                      : "rgba(255, 255, 255, 0.02)",
                    borderColor: labActive ? "#A855F7" : colors.border || "#27272A",
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)", borderColor: "rgba(168, 85, 247, 0.3)" }]}>
                    <Feather name="activity" size={18} color="#C084FC" />
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: labActive ? "#A855F7" : "transparent",
                        borderColor: labActive ? "#A855F7" : "#475569",
                      },
                    ]}
                  >
                    {labActive && <Feather name="check" size={13} color="#FFFFFF" />}
                  </View>
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground || "#FFFFFF" }]}>
                  Strategy Lab
                </Text>
                <Text style={styles.cardPort}>
                  {isEs ? "Research Cuantitativo · Puerto 8082" : "Quantitative Research · Port 8082"}
                </Text>
                <Text style={[styles.cardText, { color: colors.mutedForeground || "#94A3B8" }]}>
                  {isEs
                    ? "Laboratorio cuantitativo, simulación vela a vela, stress test Monte Carlo de ruina, auditoría de 6 Pilares pedagógicos y análisis Walk-Forward."
                    : "Quantitative research laboratory, candle-by-candle simulation, Monte Carlo ruin stress-testing, 6 pedagogical pillars audit, and Walk-Forward analysis."}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Invariant Error Banner if 0 selected */}
            {(showError || selectedCount < 1) && (
              <View style={styles.errorBanner}>
                <Feather name="alert-triangle" size={15} color="#EF4444" />
                <Text style={styles.errorText}>
                  {isEs
                    ? "Debes seleccionar mínimo 1 opción de las 2, ya que si no la app no tendría ningún sentido."
                    : "You must select at least 1 of the 2 options, otherwise this app cannot function."}
                </Text>
              </View>
            )}

            {/* Note & Action Button */}
            <View style={styles.footerNoteRow}>
              <Feather name="info" size={13} color="#64748B" />
              <Text style={styles.footerNoteText}>
                {isEs
                  ? "Podrás cambiar esta configuración en cualquier momento desde los Ajustes de la app."
                  : "You can change this configuration anytime from the app Settings."}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={selectedCount < 1}
              onPress={handleConfirm}
              style={[
                styles.confirmButton,
                {
                  backgroundColor: selectedCount >= 1 ? "#10B981" : "#334155",
                  opacity: selectedCount >= 1 ? 1 : 0.6,
                },
              ]}
            >
              <Text style={styles.confirmButtonText}>
                {isEs ? "Guardar y Comenzar" : "Save and Continue"}
              </Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.88)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContainer: {
    width: "92%",
    maxWidth: 520,
    maxHeight: "92%",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.58,
        shadowRadius: 16.0,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  scrollContent: {
    paddingVertical: 12,
  },
  badgeWrapper: {
    alignItems: "flex-start",
    marginBottom: 10,
  },
  badgeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  badgeText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  question: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  cardsContainer: {
    gap: 12,
    marginBottom: 14,
  },
  moduleCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardPort: {
    fontSize: 11,
    color: "#64748B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 6,
  },
  cardText: {
    fontSize: 12,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 11.5,
    fontWeight: "600",
    flex: 1,
    lineHeight: 15,
  },
  footerNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  footerNoteText: {
    color: "#64748B",
    fontSize: 11,
    flex: 1,
    lineHeight: 14,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
