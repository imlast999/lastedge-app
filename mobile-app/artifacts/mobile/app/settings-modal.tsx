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
  Linking,
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
  getAppFullVersion,
} from "@/lib/apiConfig";
import { testServerConnection } from "@/services/connectionTest";
import {
  registerForPushNotificationsAsync,
  sendLocalNotification,
} from "@/services/notifications";
import { lockApp } from "@/components/PinAuthModal";
import { useTranslation } from "@/hooks/useTranslation";

function formatLastSync(d: Date | null, isEs: boolean): string {
  if (!d) return isEs ? "Nunca" : "Never";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return isEs ? `Hace ${diff}s` : `${diff}s ago`;
  if (diff < 3600) return isEs ? `Hace ${Math.floor(diff / 60)} min` : `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString(isEs ? "es-ES" : "en-US", { hour: "2-digit", minute: "2-digit" });
}


export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, loading, refresh, lastSyncAt, usingMockData } = useTrading();
  const { settings, updateSetting, updateEcosystemModules, resetSettings, apiOverrides } = useSettings();
  const isEs = settings.language === "es";
  const { t } = useTranslation();

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
        `OK · ${result.latencyMs} ms · MT5 ${s.connected ? "conectado" : "desconectado"} · ${s.currency || "USD"} ${s.equity.toFixed(2)}`
      );
    } else {
      setTestResult(result.error ?? "No se pudo conectar al servidor");
    }
  }, [settings.hapticsEnabled, apiOverrides]);

  const saveConnection = useCallback(() => {
    updateSetting("serverUrl", urlDraft.trim());
    updateSetting("serverToken", tokenDraft.trim());
    Alert.alert(isEs ? "Guardado" : "Saved", isEs ? "Conexión actualizada. La app recargará datos automáticamente." : "Connection updated. App will reload data automatically.");
  }, [urlDraft, tokenDraft, updateSetting]);

  const handleRequestPermissions = useCallback(async () => {
    const isEs = settings.language === "es";
    const token = await registerForPushNotificationsAsync();
    const { status: perm } = await Notifications.getPermissionsAsync();
    setPermStatus(
      perm === "granted"
        ? token
          ? (isEs ? "Permisos concedidos · push activo" : "Permissions granted · push active")
          : (isEs ? "Permisos concedidos · notificaciones locales" : "Permissions granted · local alerts active")
        : (isEs ? "Permisos denegados — actívalos en Ajustes del sistema" : "Permissions denied — enable in System Settings")
    );
  }, [settings.language]);

  const handleTestNotification = useCallback(async () => {
    const isEs = settings.language === "es";
    await sendLocalNotification(
      "DISCRETIONARY_SIGNAL",
      isEs ? "🔔 LastEdge: Notificación de Prueba" : "🔔 LastEdge: Test Notification",
      isEs ? "Alertas locales activas (15 categorías configuradas correctamente)." : "Local alerts active (15 categories configured properly)."
    );
    if (settings.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [settings.language, settings.hapticsEnabled]);

  const handleClearBadge = useCallback(async () => {
    const isEs = settings.language === "es";
    await Notifications.setBadgeCountAsync(0);
    Alert.alert(isEs ? "Listo" : "Done", isEs ? "Contador de notificaciones reiniciado." : "Notification counter reset.");
  }, [settings.language]);

  const handleResetSettings = useCallback(() => {
    const isEs = settings.language === "es";
    Alert.alert(
      isEs ? "Restablecer ajustes" : "Reset Settings",
      isEs ? "¿Volver a la configuración predeterminada?" : "Restore factory defaults?",
      [
        { text: isEs ? "Cancelar" : "Cancel", style: "cancel" },
        {
          text: isEs ? "Restablecer" : "Reset",
          style: "destructive",
          onPress: async () => {
            await resetSettings();
            Alert.alert(isEs ? "Hecho" : "Done", isEs ? "Ajustes restablecidos." : "Settings reset.");
          },
        },
      ]
    );
  }, [settings.language, resetSettings]);

  const handleLockApp = useCallback(async () => {
    await lockApp();
    if (settings.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    Alert.alert(
      isEs ? "Aplicación Bloqueada" : "Application Locked",
      isEs ? "La aplicación ha sido bloqueada. Deberá introducir el PIN de seguridad (1623) para volver a entrar." : "The app has been locked. Please enter your 4-digit PIN (1623) to unlock.",
      [
        {
          text: "OK",
          onPress: () => {
            router.back();
            router.replace("/(tabs)");
          },
        },
      ]
    );
  }, [settings.hapticsEnabled, router]);


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
          <Text style={[styles.title, { color: colors.foreground }]}>{isEs ? "Ajustes" : "Settings"}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isEs ? "Configuración de LastEdge" : "LastEdge Configuration"}
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
      <SettingsSection title={isEs ? "Servidor" : "Server & Connection"}>
        <View style={[styles.connEdit, { borderBottomColor: colors.border }]}>
          <Text style={[styles.connLabel, { color: colors.mutedForeground }]}>
            {isEs ? "URL personalizada (vacío = APK)" : "Custom Server URL (empty = default)"}
          </Text>
          <TextInput
            value={urlDraft}
            onChangeText={setUrlDraft}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.connInput,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary },
            ]}
          />
          <Text style={[styles.connLabel, { color: colors.mutedForeground }]}>
            {isEs ? "Token API personalizado" : "Custom API Token"}
          </Text>
          <TextInput
            value={tokenDraft}
            onChangeText={setTokenDraft}
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
            <Text style={[styles.saveConnText, { color: colors.primary }]}>{isEs ? "Guardar conexión" : "Save connection"}</Text>
          </TouchableOpacity>
        </View>
        <SettingsRow
          icon="activity"
          label={isEs ? "Estado MT5" : "MT5 Status"}
          value={connected ? (isEs ? `Conectado · uptime ${status?.uptime ?? "—"}` : `Connected · uptime ${status?.uptime ?? "—"}`) : (isEs ? "Desconectado" : "Disconnected")}
          valueColor={connected ? colors.connected : colors.disconnected}
        />
        <SettingsRow
          icon="globe"
          label={isEs ? "URL efectiva" : "Effective URL"}
          value={effective.url || (isEs ? "No configurada" : "Not configured")}
        />
        <SettingsRow
          icon="key"
          label={isEs ? "Token API" : "API Token"}
          value={
            effective.token
              ? (isEs ? `Configurado · ${maskSecret(effective.token)}` : `Configured · ${maskSecret(effective.token)}`)
              : (isEs ? "No configurado" : "Not configured")
          }
          valueColor={effective.token ? colors.connected : colors.pending}
        />
        <SettingsRow
          icon="clock"
          label={isEs ? "Última sincronización" : "Last sync"}
          value={formatLastSync(lastSyncAt, isEs)}
          isLast={!testResult}
        />
        {testResult ? (
          <SettingsRow
            icon={testResult.startsWith("OK") ? "check-circle" : "alert-circle"}
            label={isEs ? "Resultado de prueba" : "Test result"}
            value={testResult}
            valueColor={testResult.startsWith("OK") ? colors.connected : colors.destructive}
            isLast
          />
        ) : null}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <ActionButton
            label={isEs ? "Probar conexión" : "Test connection"}
            icon="wifi"
            onPress={handleTestConnection}
            loading={testing}
            colors={colors}
          />
          <ActionButton
            label={isEs ? "Sincronizar" : "Sync"}
            icon="refresh-cw"
            onPress={refresh}
            loading={loading}
            colors={colors}
            outline
          />
        </View>
      </SettingsSection>

      {/* ── Ecosistema LastEdge ── */}
      <SettingsSection title={isEs ? "Ecosistema LastEdge" : "LastEdge Ecosystem"}>
        <SettingsToggle
          icon="zap"
          label="Trading Engine"
          description={isEs ? "Ejecución MT5, posiciones, señales y riesgo (:8081)" : "MT5 execution, positions, signals & risk (:8081)"}
          value={settings.ecosystemModules?.tradingEngine !== false}
          onValueChange={(v) => {
            if (!v && (!settings.ecosystemModules || !settings.ecosystemModules.strategyLab)) {
              Alert.alert(
                isEs ? "Ecosistema LastEdge" : "LastEdge Ecosystem",
                isEs
                  ? "Debes mantener al menos 1 servicio activo (Trading Engine o Strategy Lab) para que la app tenga utilidad."
                  : "You must keep at least 1 service active (Trading Engine or Strategy Lab)."
              );
              return;
            }
            updateEcosystemModules({
              tradingEngine: v,
              strategyLab: settings.ecosystemModules?.strategyLab !== false,
            });
          }}
        />
        <SettingsToggle
          icon="activity"
          label="Strategy Lab"
          description={isEs ? "Research cuantitativo, backtest vela a vela y 6 Pilares (:8082)" : "Quantitative research, backtesting & 6 Pillars (:8082)"}
          value={settings.ecosystemModules?.strategyLab !== false}
          onValueChange={(v) => {
            if (!v && (!settings.ecosystemModules || !settings.ecosystemModules.tradingEngine)) {
              Alert.alert(
                isEs ? "Ecosistema LastEdge" : "LastEdge Ecosystem",
                isEs
                  ? "Debes mantener al menos 1 servicio activo (Trading Engine o Strategy Lab) para que la app tenga utilidad."
                  : "You must keep at least 1 service active (Trading Engine or Strategy Lab)."
              );
              return;
            }
            updateEcosystemModules({
              tradingEngine: settings.ecosystemModules?.tradingEngine !== false,
              strategyLab: v,
            });
          }}
          isLast
        />
      </SettingsSection>

      {/* ── Actualización ── */}
      <SettingsSection title={isEs ? "Actualización automática" : "Auto Refresh"}>
        <SettingsToggle
          icon="repeat"
          label={isEs ? "Actualización en segundo plano" : "Background refresh"}
          description={isEs ? "Consulta el servidor periódicamente" : "Queries server periodically"}
          value={settings.autoRefresh}
          onValueChange={(v) => updateSetting("autoRefresh", v)}
        />
        <View style={[styles.intervalBlock, { borderTopColor: colors.border }]}>
          <Text style={[styles.intervalLabel, { color: colors.mutedForeground }]}>
            {isEs ? "Intervalo de consulta" : "Query interval"}
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

      {/* ── Notificaciones & Alertas (15 Categorías Granulares) ── */}
      <SettingsSection title={isEs ? "Notificaciones & Alertas" : "Notifications & Alerts"}>
        <SettingsToggle
          icon="bell"
          label={isEs ? "Notificaciones Globales" : "Global Notifications"}
          description={isEs ? "Interruptor maestro de alertas en el dispositivo" : "Master alert switch on device"}
          value={settings.notificationsEnabled}
          onValueChange={(v) => updateSetting("notificationsEnabled", v)}
        />

        {/* 1. Señales y Ejecución */}
        <View style={[styles.subSectionHeader, { borderTopColor: colors.border, borderBottomColor: colors.border, backgroundColor: colors.secondary + "40" }]}>
          <Feather name="zap" size={12} color={colors.primary} />
          <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>
            {t("notifyGroupSignals")}
          </Text>
        </View>
        <SettingsToggle
          icon="clock"
          label={t("notifyDiscretionarySignalsLabel")}
          description={t("notifyDiscretionarySignalsDesc")}
          value={settings.notifyDiscretionarySignals}
          onValueChange={(v) => updateSetting("notifyDiscretionarySignals", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="zap"
          label={t("notifyAutoExecutedSignalsLabel")}
          description={t("notifyAutoExecutedSignalsDesc")}
          value={settings.notifyAutoExecutedSignals}
          onValueChange={(v) => updateSetting("notifyAutoExecutedSignals", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="alert-circle"
          label={t("notifyExpiredSignalsLabel")}
          description={t("notifyExpiredSignalsDesc")}
          value={settings.notifyExpiredSignals}
          onValueChange={(v) => updateSetting("notifyExpiredSignals", v)}
          disabled={!settings.notificationsEnabled}
        />

        {/* 2. Órdenes y Beneficios */}
        <View style={[styles.subSectionHeader, { borderTopColor: colors.border, borderBottomColor: colors.border, backgroundColor: colors.secondary + "40" }]}>
          <Feather name="trending-up" size={12} color={colors.primary} />
          <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>
            {t("notifyGroupOrders")}
          </Text>
        </View>
        <SettingsToggle
          icon="shield"
          label={t("notifyTrailingStopBreakEvenLabel")}
          description={t("notifyTrailingStopBreakEvenDesc")}
          value={settings.notifyTrailingStopBreakEven}
          onValueChange={(v) => updateSetting("notifyTrailingStopBreakEven", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="pie-chart"
          label={t("notifyPartialTakeProfitLabel")}
          description={t("notifyPartialTakeProfitDesc")}
          value={settings.notifyPartialTakeProfit}
          onValueChange={(v) => updateSetting("notifyPartialTakeProfit", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="trending-up"
          label={t("notifyTradeCloseProfitLabel")}
          description={t("notifyTradeCloseProfitDesc")}
          value={settings.notifyTradeCloseProfit}
          onValueChange={(v) => updateSetting("notifyTradeCloseProfit", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="trending-down"
          label={t("notifyTradeCloseLossLabel")}
          description={t("notifyTradeCloseLossDesc")}
          value={settings.notifyTradeCloseLoss}
          onValueChange={(v) => updateSetting("notifyTradeCloseLoss", v)}
          disabled={!settings.notificationsEnabled}
        />

        {/* 3. Salvaguardas de Riesgo */}
        <View style={[styles.subSectionHeader, { borderTopColor: colors.border, borderBottomColor: colors.border, backgroundColor: colors.secondary + "40" }]}>
          <Feather name="shield" size={12} color={colors.primary} />
          <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>
            {t("notifyGroupRisk")}
          </Text>
        </View>
        <SettingsToggle
          icon="calendar"
          label={t("notifyWeekendGuardPreWarningLabel")}
          description={t("notifyWeekendGuardPreWarningDesc")}
          value={settings.notifyWeekendGuardPreWarning}
          onValueChange={(v) => updateSetting("notifyWeekendGuardPreWarning", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="lock"
          label={t("notifyWeekendGuardExecutionLabel")}
          description={t("notifyWeekendGuardExecutionDesc")}
          value={settings.notifyWeekendGuardExecution}
          onValueChange={(v) => updateSetting("notifyWeekendGuardExecution", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="slash"
          label={t("notifyCircuitBreakerLabel")}
          description={t("notifyCircuitBreakerDesc")}
          value={settings.notifyCircuitBreaker}
          onValueChange={(v) => updateSetting("notifyCircuitBreaker", v)}
          disabled={!settings.notificationsEnabled}
        />

        {/* 4. Strategy Lab */}
        <View style={[styles.subSectionHeader, { borderTopColor: colors.border, borderBottomColor: colors.border, backgroundColor: colors.secondary + "40" }]}>
          <Feather name="cpu" size={12} color={colors.primary} />
          <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>
            {t("notifyGroupLab")}
          </Text>
        </View>
        <SettingsToggle
          icon="cpu"
          label={t("notifyBacktestCompleteLabel")}
          description={t("notifyBacktestCompleteDesc")}
          value={settings.notifyBacktestComplete}
          onValueChange={(v) => updateSetting("notifyBacktestComplete", v)}
          disabled={!settings.notificationsEnabled}
        />

        {/* 5. Broker y Conectividad */}
        <View style={[styles.subSectionHeader, { borderTopColor: colors.border, borderBottomColor: colors.border, backgroundColor: colors.secondary + "40" }]}>
          <Feather name="wifi" size={12} color={colors.primary} />
          <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>
            {t("notifyGroupBroker")}
          </Text>
        </View>
        <SettingsToggle
          icon="wifi-off"
          label={t("notifyDisconnectLabel")}
          description={t("notifyDisconnectDesc")}
          value={settings.notifyDisconnect}
          onValueChange={(v) => updateSetting("notifyDisconnect", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="activity"
          label={t("notifySpreadSpikeLabel")}
          description={t("notifySpreadSpikeDesc")}
          value={settings.notifySpreadSpike}
          onValueChange={(v) => updateSetting("notifySpreadSpike", v)}
          disabled={!settings.notificationsEnabled}
        />

        {/* 6. Rutina y Mantenimiento */}
        <View style={[styles.subSectionHeader, { borderTopColor: colors.border, borderBottomColor: colors.border, backgroundColor: colors.secondary + "40" }]}>
          <Feather name="clock" size={12} color={colors.primary} />
          <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>
            {t("notifyGroupRoutine")}
          </Text>
        </View>
        <SettingsToggle
          icon="file-text"
          label={t("notifyDailyWrapUpLabel")}
          description={t("notifyDailyWrapUpDesc")}
          value={settings.notifyDailyWrapUp}
          onValueChange={(v) => updateSetting("notifyDailyWrapUp", v)}
          disabled={!settings.notificationsEnabled}
        />
        <SettingsToggle
          icon="download-cloud"
          label={t("notifyAppUpdateLabel")}
          description={t("notifyAppUpdateDesc")}
          value={settings.notifyAppUpdate}
          onValueChange={(v) => updateSetting("notifyAppUpdate", v)}
          disabled={!settings.notificationsEnabled}
          isLast={!permStatus}
        />

        {permStatus ? (
          <SettingsRow icon="info" label={isEs ? "Permisos" : "Permissions"} value={permStatus} isLast />
        ) : null}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <ActionButton
            label={isEs ? "Permisos" : "Permissions"}
            icon="shield"
            onPress={handleRequestPermissions}
            colors={colors}
            outline
          />
          <ActionButton
            label={isEs ? "Probar alerta" : "Test alert"}
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

      {/* ── Seguridad ── */}
      <SettingsSection title={isEs ? "Seguridad" : "Security"}>
        <SettingsRow
          icon="lock"
          label={isEs ? "Bloquear aplicación con PIN ahora" : "Lock application with PIN now"}
          value="PIN 1623"
          onPress={handleLockApp}
          isLast
        />
      </SettingsSection>

      {/* ── Datos ── */}
      <SettingsSection title={isEs ? "Datos" : "Data"}>
        <SettingsRow
          icon="trash-2"
          label={isEs ? "Limpiar badge de notificaciones" : "Clear notification badge"}
          onPress={handleClearBadge}
        />
        <SettingsRow
          icon="rotate-ccw"
          label={isEs ? "Restablecer ajustes" : "Reset settings"}
          onPress={handleResetSettings}
          destructive
          isLast
        />
      </SettingsSection>

      {/* ── Comunidad & Redes Oficiales ── */}
      <SettingsSection title={isEs ? "Comunidad & Señales" : "Community & Signals"}>
        <SettingsRow
          icon="send"
          label={isEs ? "Canal Oficial Telegram" : "Telegram Official Channel"}
          value="@LastEdgeJournal"
          onPress={() => Linking.openURL("https://t.me/LastEdgeJournal")}
        />
        <SettingsRow
          icon="instagram"
          label={isEs ? "Canal Difusión Instagram" : "Instagram Broadcast"}
          value={isEs ? "Difusión Exclusiva ↗" : "Exclusive Broadcast ↗"}
          onPress={() => Linking.openURL("https://ig.me/j/AbZrLKLRbIHnU-xw/")}
        />
        <SettingsRow
          icon="zap"
          label={isEs ? "Acceso Club VIP · Señales" : "VIP Signals · Private Club"}
          value="@imlast999"
          valueColor="#10B981"
          onPress={() => Linking.openURL("https://t.me/imlast999")}
          isLast
        />
      </SettingsSection>

      {/* ── Acerca de ── */}
      <SettingsSection title={isEs ? "Acerca de" : "About"}>
        <SettingsRow icon="box" label={isEs ? "Versión" : "Version"} value={getAppFullVersion()} />
        <SettingsRow
          icon="cpu"
          label="Expo SDK"
          value={Constants.expoConfig?.sdkVersion ?? "54"}
        />
        <SettingsRow
          icon="smartphone"
          label={isEs ? "Plataforma" : "Platform"}
          value={`${Platform.OS} ${Platform.Version}`}
        />
        <SettingsRow
          icon="database"
          label={isEs ? "Modo datos" : "Data mode"}
          value={usingMockData ? (isEs ? "Datos de ejemplo (dev)" : "Sample data (dev)") : (isEs ? "Servidor en vivo" : "Live server")}
          valueColor={usingMockData ? colors.pending : colors.connected}
        />
        <SettingsRow
          icon="shield"
          label={isEs ? "Política de Privacidad" : "Privacy Policy"}
          value={isEs ? "Ver online ↗" : "View online ↗"}
          onPress={() => Linking.openURL("https://imlast999.github.io/lastedge-app/privacy.html")}
          isLast
        />
      </SettingsSection>

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        {isEs ? "LastEdge · cuenta demo MT5" : "LastEdge · MT5 live/demo account"}{"\n"}
        {isEs ? "Intervalo predeterminado:" : "Default interval:"} {DEFAULT_SETTINGS.pollIntervalMs / 1000}s
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
  title: { fontSize: 28, fontFamily: "Nexa" },
  subtitle: { fontSize: 13, fontFamily: "Nexa", marginTop: 2 },
  subSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  subSectionTitle: {
    fontSize: 11,
    fontFamily: "Nexa",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
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
    borderRadius: 8,
  },
  actionText: { fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  intervalBlock: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  intervalLabel: { fontSize: 12, fontFamily: "PlusJakartaSans_500Medium" },
  intervalRow: { flexDirection: "row", gap: 8 },
  intervalBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  intervalText: { fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  footer: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 16,
    marginTop: 4,
  },
  connEdit: { padding: 14, gap: 8, borderBottomWidth: 1 },
  connLabel: { fontSize: 11, fontFamily: "PlusJakartaSans_500Medium" },
  connInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  saveConnBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  saveConnText: { fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
});
