import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useTrading } from "@/context/TradingContext";
import {
  useSettings,
  POLL_INTERVAL_OPTIONS,
  DEFAULT_SETTINGS,
} from "@/context/SettingsContext";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsToggle } from "@/components/settings/SettingsToggle";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import {
  getBuildApiUrl,
  getBuildApiSecret,
  resolveApiConfig,
  maskSecret,
  getAppVersion,
} from "@/lib/apiConfig";
import { testServerConnection } from "@/services/connectionTest";
import {
  registerForPushNotificationsAsync,
  sendLocalNotification,
} from "@/services/notifications";

function formatLastSync(d: Date | null): string {
  if (!d) return "Nunca";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `Hace ${diff}s`;
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, loading, refresh, lastSyncAt, usingMockData } = useTrading();
  const { settings, updateSetting, resetSettings, apiOverrides } = useSettings();

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [permStatus, setPermStatus] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState(settings.serverUrl);
  const [tokenDraft, setTokenDraft] = useState(settings.serverToken);

  const effective = resolveApiConfig(apiOverrides);
  const connected = status?.connected ?? false;

  const topPad = insets.top;
  const bottomPad = insets.bottom + 120;

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const result = await testServerConnection(apiOverrides);
    setTesting(false);
    if (result.ok && result.status) {
      const s = result.status;
      setTestResult(
        `OK · ${result.latencyMs} ms · MT5 ${s.connected ? "conectado" : "desconectado"} · ${s.equity.toFixed(2)} €`
      );
    } else {
      setTestResult(result.error ?? "No se pudo conectar al servidor");
    }
  }, [settings.hapticsEnabled, apiOverrides]);

  const saveConnection = useCallback(() => {
    updateSetting("serverUrl", urlDraft.trim());
    updateSetting("serverToken", tokenDraft.trim());
    Alert.alert("Guardado", "Conexión actualizada. La app recargará datos automáticamente.");
  }, [urlDraft, tokenDraft, updateSetting]);

  const handleRequestPermissions = useCallback(async () => {
    const token = await registerForPushNotificationsAsync();
    const { status: perm } = await Notifications.getPermissionsAsync();
    setPermStatus(
      perm === "granted"
        ? token
          ? "Permisos concedidos · push activo"
          : "Permisos concedidos · notificaciones locales"
        : "Permisos denegados — actívalos en Ajustes del sistema"
    );
  }, []);

  const handleTestNotification = useCallback(async () => {
    await sendLocalNotification(
      "NEW_SIGNAL",
      "🔔 Notificación de prueba",
      "Si ves esto, las alertas locales funcionan correctamente."
    );
    if (settings.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [settings.hapticsEnabled]);

  const handleClearBadge = useCallback(async () => {
    await Notifications.setBadgeCountAsync(0);
    Alert.alert("Listo", "Contador de notificaciones reiniciado.");
  }, []);

  const handleResetSettings = useCallback(() => {
    Alert.alert(
      "Restablecer ajustes",
      "¿Volver a la configuración predeterminada?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restablecer",
          style: "destructive",
          onPress: async () => {
            await resetSettings();
            Alert.alert("Hecho", "Ajustes restablecidos.");
          },
        },
      ]
    );
  }, [resetSettings]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: bottomPad + 16 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <ApiErrorBanner />

      {/* Modal Header with Close Button */}
      <View style={[styles.modalHeader, { paddingTop: insets.top }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Ajustes</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Configuración de LastEdge
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeButton, { backgroundColor: colors.secondary }]}
        >
          <Feather name="x" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* ── Servidor ── */}
      <SettingsSection title="Servidor">
        <View style={[styles.connEdit, { borderBottomColor: colors.border }]}>
          <Text style={[styles.connLabel, { color: colors.mutedForeground }]}>
            URL personalizada (vacío = APK)
          </Text>
          <TextInput
            value={urlDraft}
            onChangeText={setUrlDraft}
            placeholder={getBuildApiUrl() || "http://192.168.1.X:5000"}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.connInput,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary },
            ]}
          />
          <Text style={[styles.connLabel, { color: colors.mutedForeground }]}>
            Token API personalizado
          </Text>
          <TextInput
            value={tokenDraft}
            onChangeText={setTokenDraft}
            placeholder={maskSecret(getBuildApiSecret())}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            style={[
              styles.connInput,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary },
            ]}
          />
          <TouchableOpacity
            onPress={saveConnection}
            style={[styles.saveConnBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Feather name="save" size={15} color={colors.primary} />
            <Text style={[styles.saveConnText, { color: colors.primary }]}>Guardar conexión</Text>
          </TouchableOpacity>
        </View>
        <SettingsRow
          icon="activity"
          label="Estado MT5"
          value={connected ? `Conectado · uptime ${status?.uptime ?? "—"}` : "Desconectado"}
          valueColor={connected ? colors.connected : colors.disconnected}
        />
        <SettingsRow
          icon="globe"
          label="URL efectiva"
          value={effective.url || "No configurada"}
        />
        <SettingsRow
          icon="key"
          label="Token API"
          value={
            effective.token
              ? `Configurado · ${maskSecret(effective.token)}`
              : "No configurado"
          }
          valueColor={effective.token ? colors.connected : colors.pending}
        />
        <SettingsRow
          icon="clock"
          label="Última sincronización"
          value={formatLastSync(lastSyncAt)}
          isLast={!testResult}
        />
        {testResult ? (
          <SettingsRow
            icon={testResult.startsWith("OK") ? "check-circle" : "alert-circle"}
            label="Resultado de prueba"
            value={testResult}
            valueColor={testResult.startsWith("OK") ? colors.connected : colors.destructive}
            isLast
          />
        ) : null}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <ActionButton
            label="Probar conexión"
            icon="wifi"
            onPress={handleTestConnection}
            loading={testing}
            colors={colors}
          />
          <ActionButton
            label="Sincronizar"
            icon="refresh-cw"
            onPress={refresh}
            loading={loading}
            colors={colors}
            outline
          />
        </View>
      </SettingsSection>

      {/* ── Actualización ── */}
      <SettingsSection title="Actualización automática">
        <SettingsToggle
          icon="repeat"
          label="Actualización en segundo plano"
          description="Consulta el servidor periódicamente"
          value={settings.autoRefresh}
          onValueChange={(v) => updateSetting("autoRefresh", v)}
        />
        <View style={[styles.intervalBlock, { borderTopColor: colors.border }]}>
          <Text style={[styles.intervalLabel, { color: colors.mutedForeground }]}>
            Intervalo de consulta
          </Text>
          <View style={styles.intervalRow}>
            {POLL_INTERVAL_OPTIONS.map((opt) => {
              const active = settings.pollIntervalMs === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  disabled={!settings.autoRefresh}
                  onPress={() => updateSetting("pollIntervalMs", opt.value)}
                  style={[
                    styles.intervalBtn,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                      borderColor: active ? colors.primary : colors.border,
                      opacity: settings.autoRefresh ? 1 : 0.45,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.intervalText,
                      { color: active ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SettingsSection>

      {/* ── Notificaciones ── */}
      <SettingsSection title="Notificaciones">
        <SettingsToggle
          icon="bell"
          label="Notificaciones"
          description="Alertas locales en el dispositivo"
          value={settings.notificationsEnabled}
          onValueChange={(v) => updateSetting("notificationsEnabled", v)}
        />
        <SettingsToggle
          icon="target"
          label="Nuevas señales"
          value={settings.notifyNewSignals}
          onValueChange={(v) => updateSetting("notifyNewSignals", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="check-circle"
          label="Cierre de operaciones"
          value={settings.notifyTradeClose}
          onValueChange={(v) => updateSetting("notifyTradeClose", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="alert-triangle"
          label="Desconexión MT5"
          description="Alerta crítica si el bot pierde conexión"
          value={settings.notifyDisconnect}
          onValueChange={(v) => updateSetting("notifyDisconnect", v)}
          disabled={!settings.notificationsEnabled}
          isLast={!permStatus}
        />
        {permStatus ? (
          <SettingsRow icon="info" label="Permisos" value={permStatus} isLast />
        ) : null}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <ActionButton
            label="Permisos"
            icon="shield"
            onPress={handleRequestPermissions}
            colors={colors}
            outline
          />
          <ActionButton
            label="Probar alerta"
            icon="bell"
            onPress={handleTestNotification}
            colors={colors}
            outline
            disabled={!settings.notificationsEnabled}
          />
        </View>
      </SettingsSection>

      {/* ── Interfaz ── */}
      <SettingsSection title={settings.language === 'es' ? "Interfaz" : "Interface"}>
        {/* ── Language selector ── */}
        <View style={[styles.intervalBlock, { borderBottomColor: colors.border }]}>
          <Text style={[styles.intervalLabel, { color: colors.mutedForeground }]}>
            {settings.language === 'es' ? "Idioma de la app" : "App language"}
          </Text>
          <Text style={[styles.connLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
            {settings.language === 'es' ? "Cambiar el idioma de la interfaz" : "Change the app interface language"}
          </Text>
          <View style={styles.intervalRow}>
            <TouchableOpacity
              onPress={() => updateSetting("language", "en")}
              style={[
                styles.intervalBtn,
                {
                  backgroundColor: settings.language === 'en' ? colors.primary : colors.secondary,
                  borderColor: settings.language === 'en' ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16 }}>🇬🇧</Text>
                <Text
                  style={[
                    styles.intervalText,
                    { color: settings.language === 'en' ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  English
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateSetting("language", "es")}
              style={[
                styles.intervalBtn,
                {
                  backgroundColor: settings.language === 'es' ? colors.primary : colors.secondary,
                  borderColor: settings.language === 'es' ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16 }}>🇪🇸</Text>
                <Text
                  style={[
                    styles.intervalText,
                    { color: settings.language === 'es' ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  Español
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <SettingsToggle
          icon="smartphone"
          label={settings.language === 'es' ? "Vibración háptica" : "Haptic feedback"}
          description={settings.language === 'es' ? "Feedback al pulsar botones de prueba" : "Feedback when pressing test buttons"}
          value={settings.hapticsEnabled}
          onValueChange={(v) => updateSetting("hapticsEnabled", v)}
          isLast
        />
      </SettingsSection>

      {/* ── Datos ── */}
      <SettingsSection title="Datos">
        <SettingsRow
          icon="trash-2"
          label="Limpiar badge de notificaciones"
          onPress={handleClearBadge}
        />
        <SettingsRow
          icon="rotate-ccw"
          label="Restablecer ajustes"
          onPress={handleResetSettings}
          destructive
          isLast
        />
      </SettingsSection>

      {/* ── Acerca de ── */}
      <SettingsSection title="Acerca de">
        <SettingsRow icon="box" label="Versión" value={getAppVersion()} />
        <SettingsRow
          icon="cpu"
          label="Expo SDK"
          value={Constants.expoConfig?.sdkVersion ?? "54"}
        />
        <SettingsRow
          icon="smartphone"
          label="Plataforma"
          value={`${Platform.OS} ${Platform.Version}`}
        />
        <SettingsRow
          icon="database"
          label="Modo datos"
          value={usingMockData ? "Datos de ejemplo (dev)" : "Servidor en vivo"}
          valueColor={usingMockData ? colors.pending : colors.connected}
          isLast
        />
      </SettingsSection>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        LastEdge · cuenta demo MT5{"\n"}
        Intervalo predeterminado: {DEFAULT_SETTINGS.pollIntervalMs / 1000}s
      </Text>
    </ScrollView>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  loading,
  colors,
  outline,
  disabled,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  loading?: boolean;
  colors: ReturnType<typeof useColors>;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.75}
      style={[
        styles.actionBtn,
        outline
          ? { backgroundColor: "transparent", borderColor: colors.border, borderWidth: 1 }
          : { backgroundColor: colors.primary },
        (loading || disabled) && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={outline ? colors.primary : colors.primaryForeground} />
      ) : (
        <>
          <Feather
            name={icon}
            size={15}
            color={outline ? colors.primary : colors.primaryForeground}
          />
          <Text
            style={[
              styles.actionText,
              { color: outline ? colors.primary : colors.primaryForeground },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 20 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  header: { marginBottom: 4 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  intervalBlock: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  intervalLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  intervalRow: { flexDirection: "row", gap: 8 },
  intervalBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  intervalText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  footer: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 4,
  },
  connEdit: { padding: 14, gap: 8, borderBottomWidth: 1 },
  connLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  connInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  saveConnBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  saveConnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
