import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";
import { useColors } from "@/hooks/useColors";

export const DISCLAIMER_STORAGE_KEY = "@lastedge_disclaimer_accepted_v1";

interface EcosystemDisclaimerModalProps {
  onAccepted?: () => void;
}

export function EcosystemDisclaimerModal({ onAccepted }: EcosystemDisclaimerModalProps) {
  const { settings, loaded } = useSettings();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);

  const isEs = settings?.language === "es";

  useEffect(() => {
    async function checkStatus() {
      try {
        const accepted = await AsyncStorage.getItem(DISCLAIMER_STORAGE_KEY);
        if (accepted !== "true") {
          setVisible(true);
        }
      } catch {
        setVisible(true);
      } finally {
        setChecking(false);
      }
    }
    checkStatus();
  }, []);

  const handleAccept = async () => {
    try {
      await AsyncStorage.setItem(DISCLAIMER_STORAGE_KEY, "true");
    } catch {
      // Storage fallback
    }
    setVisible(false);
    onAccepted?.();
  };

  if (!loaded || checking || !visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent={true}
    >
      <View style={[styles.container, { backgroundColor: colors.background || "#090B10" }]}>
        {/* Ambient background glows */}
        <View style={styles.ambientGlowTop} />
        <View style={styles.ambientGlowBottom} />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 16, 36),
              paddingBottom: Math.max(insets.bottom + 24, 40),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Protocol Badge */}
          <View style={styles.badgeWrapper}>
            <View style={styles.badgeTag}>
              <Feather name="shield" size={13} color="#10B981" />
              <Text style={styles.badgeText}>
                {isEs ? "PROTOCOLO LASTEDGE · CLIENTE PÚBLICO" : "LASTEDGE PROTOCOL · PUBLIC TERMINAL"}
              </Text>
            </View>
          </View>

          {/* Main Title */}
          <Text style={[styles.mainTitle, { color: colors.foreground || "#FFFFFF" }]}>
            {isEs ? "¿Qué es LastEdge?" : "What is LastEdge?"}
          </Text>

          {/* Subtitle notice */}
          <Text style={[styles.mainSubtitle, { color: colors.mutedForeground || "#94A3B8" }]}>
            {isEs
              ? "Aviso obligatorio de arquitectura, soberanía de datos y requisitos de funcionamiento."
              : "Mandatory notice on architecture, data sovereignty, and operation requirements."}
          </Text>

          {/* Section 1: Institutional Client Definition */}
          <View style={[styles.card, { backgroundColor: colors.card || "#12141A", borderColor: colors.border || "#27272A" }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.3)" }]}>
                <Feather name="monitor" size={18} color="#60A5FA" />
              </View>
              <Text style={[styles.cardSectionTitle, { color: colors.foreground || "#FFFFFF" }]}>
                {isEs ? "Un Terminal de Telemetría y Control" : "A Telemetry & Supervision Terminal"}
              </Text>
            </View>
            <Text style={[styles.cardBodyText, { color: colors.mutedForeground || "#94A3B8" }]}>
              {isEs
                ? "LastEdge es un terminal cuantitativo institucional diseñado para la supervisión analítica, telemetría de órdenes y visualización de ejecución conectada a MetaTrader 5 (MT5).\n\nEsta aplicación móvil actúa estrictamente como un cliente visual remoto. NO contiene un bróker interno, servidores centrales de ejecución ni feeds de datos propios dentro de la app móvil."
                : "LastEdge is an institutional-grade quantitative terminal designed for analytical supervision, order telemetry, and execution visualization connected to MetaTrader 5 (MT5).\n\nThis mobile app operates strictly as a remote visual client. It DOES NOT contain an embedded broker, centralized execution servers, or internal market feeds inside the mobile application."}
            </Text>
          </View>

          {/* Section 2: The Two Mandatory Backend Modules */}
          <View style={[styles.card, { backgroundColor: colors.card || "#12141A", borderColor: colors.border || "#27272A" }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
                <Feather name="server" size={18} color="#34D399" />
              </View>
              <Text style={[styles.cardSectionTitle, { color: colors.foreground || "#FFFFFF" }]}>
                {isEs ? "Los 2 Módulos Obligatorios" : "The 2 Mandatory Backend Modules"}
              </Text>
            </View>
            <Text style={[styles.cardBodyText, { color: colors.mutedForeground || "#94A3B8" }]}>
              {isEs
                ? "Para que esta aplicación funcione, DEBES disponer o conectarte a al menos uno de los 2 servicios oficiales de LastEdge ejecutándose en tu servidor, VPS o PC:"
                : "For this app to work, you MUST host or connect to at least one of the 2 official LastEdge services running on your own VPS, server, or PC:"}
            </Text>

            {/* Module A: Trading Engine */}
            <View style={[styles.moduleItem, { backgroundColor: "rgba(14, 165, 233, 0.06)", borderColor: "rgba(14, 165, 233, 0.25)" }]}>
              <View style={styles.moduleItemHeader}>
                <Feather name="zap" size={16} color="#38BDF8" />
                <Text style={styles.moduleItemTitle}>
                  1. LastEdge Trading Engine <Text style={styles.portBadge}>Port 8081</Text>
                </Text>
              </View>
              <Text style={[styles.moduleItemDesc, { color: colors.mutedForeground || "#94A3B8" }]}>
                {isEs
                  ? "Conector directo con MetaTrader 5, despacho de órdenes sub-50ms, motor de riesgo institucional, SpreadGuard y Trailing Stops dinámicos en tiempo real."
                  : "Direct MetaTrader 5 daemon, sub-50ms order dispatch, institutional risk engine, SpreadGuard slippage filter, and real-time dynamic trailing stops."}
              </Text>
            </View>

            {/* Module B: Strategy Lab */}
            <View style={[styles.moduleItem, { backgroundColor: "rgba(168, 85, 247, 0.06)", borderColor: "rgba(168, 85, 247, 0.25)" }]}>
              <View style={styles.moduleItemHeader}>
                <Feather name="activity" size={16} color="#C084FC" />
                <Text style={styles.moduleItemTitle}>
                  2. LastEdge Strategy Lab <Text style={styles.portBadge}>Port 8082</Text>
                </Text>
              </View>
              <Text style={[styles.moduleItemDesc, { color: colors.mutedForeground || "#94A3B8" }]}>
                {isEs
                  ? "Estación de research cuantitativo, simulación vela a vela, stress test Monte Carlo de ruina (5.000 iteraciones) y auditoría de 6 Pilares pedagógicos."
                  : "Quantitative research station, tick-by-tick backtesting simulation, Monte Carlo ruin stress-testing (5,000 iterations), and 6 pedagogical pillars audit."}
              </Text>
            </View>
          </View>

          {/* Section 3: Connection & Privacy */}
          <View style={[styles.card, { backgroundColor: colors.card || "#12141A", borderColor: colors.border || "#27272A" }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)", borderColor: "rgba(245, 158, 11, 0.3)" }]}>
                <Feather name="key" size={18} color="#FBBF24" />
              </View>
              <Text style={[styles.cardSectionTitle, { color: colors.foreground || "#FFFFFF" }]}>
                {isEs ? "Soberanía y Configuración" : "Data Sovereignty & Connection"}
              </Text>
            </View>
            <Text style={[styles.cardBodyText, { color: colors.mutedForeground || "#94A3B8" }]}>
              {isEs
                ? "Tú mantienes el control absoluto de tus credenciales de bróker y claves API. Una vez que tengas tu servidor funcionando (24/7 en tu VPS o local), solo debes introducir la IP de tu servidor y tu API Key en la pantalla de Ajustes de esta app."
                : "You maintain 100% control over your broker credentials and API keys. Once your self-hosted instance is running (24/7 on your VPS or local machine), simply enter your server IP and API Key in the Settings screen of this app."}
            </Text>
          </View>

          {/* Critical Warning Box */}
          <View style={styles.warningBox}>
            <View style={styles.warningHeaderRow}>
              <MaterialCommunityIcons name="alert-decagram" size={20} color="#F59E0B" />
              <Text style={styles.warningTitle}>
                {isEs ? "AVISO CRÍTICO DE USO" : "CRITICAL OPERATIONAL NOTICE"}
              </Text>
            </View>
            <Text style={styles.warningBody}>
              {isEs
                ? "Esta app NO funcionará por sí sola sin tener activo al menos uno de los dos módulos de LastEdge en tu servidor. Si no dispones de un servidor configurado con el Trading Engine o Strategy Lab, la aplicación no podrá mostrarte telemetría, posiciones ni ejecutar análisis."
                : "This app will NOT work standalone without at least one of the two LastEdge backend modules running on your server. If you do not have a server configured with the Trading Engine or Strategy Lab, this app will not display live telemetry, positions, or backtests."}
            </Text>
          </View>

          {/* Mandatory Confirmation Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAccept}
            style={styles.confirmButton}
          >
            <View style={styles.buttonContent}>
              <Feather name="check-circle" size={18} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.confirmButtonText}>
                {isEs
                  ? "He leído todo y entiendo que esta app no funcionará sola sin alguno de los módulos de LastEdge"
                  : "I have read everything and understand that this app will not work without at least one LastEdge module"}
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientGlowTop: {
    position: "absolute",
    top: -60,
    left: "10%",
    width: 320,
    height: 240,
    borderRadius: 160,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  ambientGlowBottom: {
    position: "absolute",
    bottom: -60,
    right: "5%",
    width: 320,
    height: 240,
    borderRadius: 160,
    backgroundColor: "rgba(59, 130, 246, 0.07)",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  badgeWrapper: {
    alignItems: "flex-start",
    marginBottom: 14,
  },
  badgeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#34D399",
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  mainSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  cardBodyText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  moduleItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
  },
  moduleItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  moduleItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  portBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
  moduleItemDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  warningBox: {
    borderRadius: 16,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    padding: 16,
    marginBottom: 24,
  },
  warningHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#FBBF24",
  },
  warningBody: {
    fontSize: 12.5,
    lineHeight: 19,
    color: "#FDE68A",
  },
  confirmButton: {
    backgroundColor: "#10B981",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    flex: 1,
    lineHeight: 19,
  },
});
