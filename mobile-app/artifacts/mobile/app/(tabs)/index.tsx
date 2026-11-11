import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Redirect } from "expo-router";
import { useSettings } from "@/context/SettingsContext";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTrading } from "@/context/TradingContext";
import { useTranslation } from "@/hooks/useTranslation";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { StatsCard } from "@/components/StatsCard";
import { EquityChart } from "@/components/EquityChart";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import RiskWidget from "@/components/RiskWidget";
import { BrokerQualityWidget } from "@/components/BrokerQualityWidget";

export default function DashboardScreen() {
  const { settings } = useSettings();
  if (settings.ecosystemModules && !settings.ecosystemModules.tradingEngine && settings.ecosystemModules.strategyLab) {
    return <Redirect href="/lab" />;
  }
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useTranslation();
  const isEs = language === "es";
  const {
    status,
    equityHistory,
    dailyPnL,
    winrate,
    openPositions,
    pendingSignals,
    currencySymbol,
    loading,
    refresh,
    usingMockData,
  } = useTrading();

  const safeStatus = {
    connected: Boolean(status?.connected),
    uptime: status?.uptime || "–",
    balance: Number(status?.balance ?? 0),
    equity: Number(status?.equity ?? status?.balance ?? 0),
    margin: Number(status?.margin ?? 0),
    freeMargin: Number(status?.freeMargin ?? status?.balance ?? 0),
    executionQuality: status?.executionQuality,
  };

  const isProfit = (Number(dailyPnL) || 0) >= 0;
  const floatingPnL = safeStatus.equity - safeStatus.balance;
  const floatPct = safeStatus.balance > 0 ? (floatingPnL / safeStatus.balance) * 100 : 0;
  const pingMs = Math.round(safeStatus.executionQuality?.avgLatency ?? (usingMockData ? 12 : 24));
  const bottomPad = insets.bottom + 90;

  const handleOpenSettings = () => {
    router.push("/settings-modal" as any);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: bottomPad },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <ApiErrorBanner />

      {/* Terminal Workspace Header (dashboard_new.tsx style) */}
      <View style={styles.workspaceHeader}>
        <View style={styles.workspaceProfile}>
          <View style={styles.avatarBox}>
            <Image
              source={require("@/assets/images/logo-e.png")}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          </View>
          <View style={styles.workspaceMeta}>
            <Text style={[styles.workspaceTitle, { color: colors.foreground }]} numberOfLines={1}>
              LastEdge App
            </Text>
            <Text style={[styles.workspaceSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {usingMockData
                ? "Interactive Sandbox"
                : safeStatus.connected
                ? "Production · Online"
                : "Production · Offline"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <ConnectionBadge connected={safeStatus.connected} uptime={safeStatus.uptime} isDemo={usingMockData} />
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={[styles.settingsButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="settings" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Institutional MT5 Balance & Equity Bento Card (Tour Step 1 Real Implementation) */}
      <View style={[styles.equityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Top telemetry status bar */}
        <View style={styles.telemetryTopBar}>
          <View style={styles.serverPill}>
            <View
              style={[
                styles.serverDot,
                { backgroundColor: usingMockData ? "#10B981" : safeStatus.connected ? "#10B981" : "#EF4444" },
              ]}
            />
            <Text style={styles.serverPillText}>
              {usingMockData
                ? "DEMO SANDBOX (12ms)"
                : safeStatus.connected
                ? `MT5: CONNECTED (${pingMs}ms)`
                : "MT5: OFFLINE"}
            </Text>
          </View>
          <Text style={[styles.brokerMode, { color: colors.mutedForeground }]}>
            {usingMockData || safeStatus.connected ? "Raw Spread ECN" : "Terminal Disconnected"}
          </Text>
        </View>

        {/* 2-Column Institutional Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>LIVE BALANCE</Text>
            <Text style={[styles.metricValue, { color: colors.foreground }]}>
              {currencySymbol}{safeStatus.balance.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>EQUITY</Text>
            <Text
              style={[
                styles.metricValue,
                { color: floatingPnL >= 0 ? "#10B981" : "#EF4444" },
              ]}
            >
              {currencySymbol}{safeStatus.equity.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Sub-bar: Free Margin & Floating PnL */}
        <View style={[styles.telemetryFooterBar, { backgroundColor: "rgba(255, 255, 255, 0.03)" }]}>
          <Text style={[styles.telemetryFooterText, { color: colors.mutedForeground }]}>
            Free Margin: {currencySymbol}{safeStatus.freeMargin.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text
            style={[
              styles.telemetryFooterText,
              { color: floatingPnL >= 0 ? "#10B981" : "#EF4444", fontWeight: "700" },
            ]}
          >
            {floatingPnL >= 0 ? "+" : ""}{currencySymbol}{floatingPnL.toFixed(2)} ({floatingPnL >= 0 ? "+" : ""}{floatPct.toFixed(1)}%)
          </Text>
        </View>

        {/* Equity Chart with Cartesian Grid & Precision Labels (INTACT) */}
        <View style={styles.chartContainer}>
          <EquityChart data={equityHistory} height={120} showLabels={true} />
        </View>

        <View style={[styles.chartFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>
            {t("last24h")} · {t("updateEvery5s")}
          </Text>
          <View style={styles.footerLegend}>
            <View style={[styles.legendDot, { backgroundColor: colors.profit }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Live Feed</Text>
          </View>
        </View>
      </View>

      {/* KPI Stats Grid */}
      <View style={styles.statsGrid}>
        <StatsCard
          label={t("profitDay")}
          value={`${isProfit ? "+" : ""}${currencySymbol}${dailyPnL.toFixed(2)}`}
          icon="trending-up"
          trend={isProfit ? "up" : "down"}
          accent={isProfit ? colors.profit : colors.loss}
          subValue={isProfit ? t("inProfit") : t("inLoss")}
        />
        <StatsCard
          label={t("winrate")}
          value={`${winrate.toFixed(1)}%`}
          icon="percent"
          trend={winrate >= 50 ? "up" : "down"}
          accent={winrate >= 50 ? colors.profit : colors.loss}
        />
      </View>

      <View style={styles.statsGrid}>
        <StatsCard
          label={t("open")}
          value={String(openPositions)}
          icon="activity"
          trend="neutral"
          accent="#60a5fa"
        />
        <StatsCard
          label={t("pending")}
          value={String(pendingSignals)}
          icon="bell"
          trend={pendingSignals > 0 ? "up" : "neutral"}
          accent={pendingSignals > 0 ? colors.pending : colors.mutedForeground}
          subValue={pendingSignals > 0 ? t("requiresAction") : undefined}
        />
      </View>

      <RiskWidget />
      <BrokerQualityWidget />

      {/* Execution Quality Card */}
      {safeStatus.executionQuality && (
        <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.accountTitle, { color: colors.foreground }]}>Execution Quality</Text>
          <AccountRow
            label="Success Rate"
            value={`${safeStatus.executionQuality.successRate}%`}
            colors={colors}
            highlight={safeStatus.executionQuality.successRate >= 95}
          />
          <AccountRow
            label="Avg Latency"
            value={`${safeStatus.executionQuality.avgLatency} ms`}
            colors={colors}
          />
          <AccountRow
            label="Avg Slippage"
            value={`${safeStatus.executionQuality.avgSlippage} pips`}
            colors={colors}
          />
        </View>
      )}

      {/* ── Web3 Bento Margin & Capital Safeguards Telemetry ── */}
      <View style={styles.bentoMarginCard}>
        <View style={styles.bentoHeaderRow}>
          <View style={styles.bentoTitleGroup}>
            <View style={styles.bentoIconPill}>
              <Feather name="pie-chart" size={14} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.bentoCardTitle}>{isEs ? "TELEMETRÍA DE MARGEN & CAPITAL" : "MARGIN & CAPITAL TELEMETRY"}</Text>
              <Text style={styles.bentoCardSub}>{isEs ? "Controles de Liquidez y Solvencia MT5" : "MT5 Liquidity & Solvency Controls"}</Text>
            </View>
          </View>
          <View style={styles.bentoBadge}>
            <Text style={styles.bentoBadgeText}>INSTITUTIONAL</Text>
          </View>
        </View>

        {/* 1. Margen Libre Indicator */}
        <View style={styles.indicatorBlock}>
          <View style={styles.indicatorHeader}>
            <Text style={styles.indicatorLabel}>{isEs ? "Margen Libre Disponible" : "Free Margin Available"}</Text>
            <Text style={styles.indicatorValue}>
              {currencySymbol}{safeStatus.freeMargin.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <Text style={styles.indicatorSub}>
                ({safeStatus.equity > 0 ? ((safeStatus.freeMargin / safeStatus.equity) * 100).toFixed(1) : "100.0"}%)
              </Text>
            </Text>
          </View>
          <View style={styles.hdProgressTrack}>
            <View
              style={[
                styles.hdProgressFill,
                {
                  width: `${safeStatus.equity > 0 ? Math.min(100, Math.max(0, (safeStatus.freeMargin / safeStatus.equity) * 100)) : 100}%`,
                  backgroundColor: "#10B981",
                  shadowColor: "#10B981",
                },
              ]}
            />
          </View>
        </View>

        {/* 2. Equidad vs Balance Indicator */}
        <View style={styles.indicatorBlock}>
          <View style={styles.indicatorHeader}>
            <Text style={styles.indicatorLabel}>{isEs ? "Equidad vs Balance" : "Equity vs Balance"}</Text>
            <Text style={styles.indicatorValue}>
              {currencySymbol}{safeStatus.equity.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <Text style={{ color: floatingPnL >= 0 ? "#34D399" : "#F87171", fontSize: 11, fontWeight: "700" }}>
                ({floatingPnL >= 0 ? "+" : ""}{currencySymbol}{floatingPnL.toFixed(2)} Float)
              </Text>
            </Text>
          </View>
          <View style={styles.hdProgressTrack}>
            <View
              style={[
                styles.hdProgressFill,
                {
                  width: `${safeStatus.balance > 0 ? Math.min(100, Math.max(0, (safeStatus.equity / safeStatus.balance) * 100)) : 100}%`,
                  backgroundColor: floatingPnL >= 0 ? "#10B981" : "#EF4444",
                  shadowColor: floatingPnL >= 0 ? "#10B981" : "#EF4444",
                },
              ]}
            />
          </View>
        </View>

        {/* 3. Nivel de Margen Indicator */}
        {(() => {
          const marginLvl = safeStatus.margin > 0 ? (safeStatus.equity / safeStatus.margin) * 100 : 9999;
          const isLvlHealthy = marginLvl >= 500;
          const isLvlWarning = marginLvl < 500 && marginLvl >= 200;
          const lvlColor = isLvlHealthy ? "#10B981" : isLvlWarning ? "#F59E0B" : "#EF4444";
          const clampedBar = Math.min(100, Math.max(0, (marginLvl / 1000) * 100));

          return (
            <View style={styles.indicatorBlock}>
              <View style={styles.indicatorHeader}>
                <Text style={styles.indicatorLabel}>{isEs ? "Nivel de Margen (Margin Level)" : "Margin Level"}</Text>
                <Text style={[styles.indicatorValue, { color: lvlColor }]}>
                  {safeStatus.margin > 0 ? `${marginLvl.toFixed(0)}%` : (isEs ? "Infinito (Sin margen usado)" : "Infinite (No margin used)")}
                </Text>
              </View>
              <View style={styles.hdProgressTrack}>
                <View
                  style={[
                    styles.hdProgressFill,
                    {
                      width: `${clampedBar}%`,
                      backgroundColor: lvlColor,
                      shadowColor: lvlColor,
                    },
                  ]}
                />
              </View>
              <View style={styles.indicatorScaleRow}>
                <Text style={styles.indicatorScaleText}>{isEs ? "Crítico: <200%" : "Critical: <200%"}</Text>
                <Text style={styles.indicatorScaleText}>{isEs ? "Precaución: 500%" : "Caution: 500%"}</Text>
                <Text style={styles.indicatorScaleText}>{isEs ? "Excelente: >1000%" : "Optimal: >1000%"}</Text>
              </View>
            </View>
          );
        })()}
      </View>

      {/* ── Community & VIP Signals Hub ── */}
      <View style={styles.communityCard}>
        <View style={styles.communityHeaderRow}>
          <View style={styles.communityTitleGroup}>
            <View style={styles.communityIconPill}>
              <Feather name="globe" size={14} color="#10B981" />
            </View>
            <View>
              <Text style={styles.communityCardTitle}>
                {isEs ? "COMUNIDAD & SEÑALES VIP" : "COMMUNITY & VIP SIGNALS"}
              </Text>
              <Text style={styles.communityCardSub}>
                {isEs ? "Canales oficiales y acceso directo" : "Official channels & direct access"}
              </Text>
            </View>
          </View>
          <View style={styles.communityBadge}>
            <Text style={styles.communityBadgeText}>{isEs ? "OFICIAL" : "OFFICIAL"}</Text>
          </View>
        </View>

        {/* Grid for Telegram & Instagram */}
        <View style={styles.socialGridRow}>
          <TouchableOpacity
            style={styles.socialBtn}
            activeOpacity={0.75}
            onPress={() => Linking.openURL("https://t.me/LastEdgeJournal")}
          >
            <View style={[styles.socialIconWrap, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
              <Feather name="send" size={15} color="#38BDF8" />
            </View>
            <View style={styles.socialBtnContent}>
              <Text style={styles.socialBtnTitle}>{isEs ? "Telegram Diario" : "Telegram Daily"}</Text>
              <Text style={styles.socialBtnSub}>@LastEdgeJournal</Text>
            </View>
            <Feather name="arrow-up-right" size={14} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialBtn}
            activeOpacity={0.75}
            onPress={() => Linking.openURL("https://ig.me/j/AbZrLKLRbIHnU-xw/")}
          >
            <View style={[styles.socialIconWrap, { backgroundColor: "rgba(225, 48, 108, 0.12)" }]}>
              <Feather name="instagram" size={15} color="#E1306C" />
            </View>
            <View style={styles.socialBtnContent}>
              <Text style={styles.socialBtnTitle}>Instagram</Text>
              <Text style={styles.socialBtnSub}>{isEs ? "Canal Difusión" : "Broadcast Channel"}</Text>
            </View>
            <Feather name="arrow-up-right" size={14} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Featured VIP Banner */}
        <TouchableOpacity
          style={styles.vipBannerBtn}
          activeOpacity={0.82}
          onPress={() => Linking.openURL("https://t.me/imlast999")}
        >
          <View style={styles.vipLeftContent}>
            <View style={styles.vipIconWrap}>
              <Feather name="zap" size={18} color="#10B981" />
            </View>
            <View style={styles.vipTextCol}>
              <View style={styles.vipTitleRow}>
                <Text style={styles.vipTitleText}>
                  {isEs ? "Acceso Club VIP · Señales" : "VIP Signals · Private Club"}
                </Text>
                <View style={styles.vipPillBadge}>
                  <Text style={styles.vipPillText}>DIRECT</Text>
                </View>
              </View>
              <Text style={styles.vipSubText}>
                {isEs
                  ? "Habla directamente con @imlast999 para resolver dudas y unirte"
                  : "Message @imlast999 directly for questions & access"}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color="#10B981" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function AccountRow({
  label,
  value,
  colors,
  highlight,
}: {
  label: string;
  value: string;
  colors: any;
  highlight?: boolean;
}) {
  return (
    <View style={styles.accountRow}>
      <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          styles.accountValue,
          { color: highlight ? colors.profit : colors.foreground },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  workspaceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  workspaceProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  avatarBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  workspaceMeta: {
    flexDirection: "column",
    flexShrink: 1,
  },
  workspaceTitle: {
    fontSize: 13,
    fontFamily: "Nexa",
    lineHeight: 16,
  },
  workspaceSub: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    lineHeight: 13,
  },
  headerActions: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexShrink: 0,
  },
  settingsButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  equityCard: {
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  telemetryTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },
  serverPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  serverDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  serverPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.4,
  },
  brokerMode: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  metricsGrid: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  metricBlock: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: -0.5,
  },
  metricDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
  },
  telemetryFooterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 6,
  },
  telemetryFooterText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  equityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    paddingBottom: 8,
  },
  equityLeft: {
    gap: 2,
  },
  equityLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  equityValue: {
    fontSize: 28,
    fontFamily: "PlusJakartaSans_500Medium",
    fontVariant: ["tabular-nums"],
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  currencySymbol: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  equityRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  floatingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  floatingText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    fontVariant: ["tabular-nums"],
  },
  balanceValue: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    fontVariant: ["tabular-nums"],
  },
  chartContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  footerLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  footerLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legendText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  bentoMarginCard: {
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  bentoHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
  },
  bentoTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bentoIconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  bentoCardTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: 0.5,
  },
  bentoCardSub: {
    fontSize: 10,
    color: "#64748B",
  },
  bentoBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  bentoBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#60A5FA",
  },
  indicatorBlock: {
    gap: 6,
  },
  indicatorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  indicatorLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },
  indicatorValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F8FAFC",
    fontVariant: ["tabular-nums"],
  },
  indicatorSub: {
    color: "#64748B",
    fontSize: 10,
  },
  hdProgressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  hdProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  indicatorScaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  indicatorScaleText: {
    fontSize: 9,
    color: "#475569",
    fontVariant: ["tabular-nums"],
  },
  accountCard: {
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    gap: 10,
  },
  accountTitle: {
    fontSize: 13,
    fontFamily: "Nexa",
    letterSpacing: 0.2,
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountLabel: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  accountValue: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    fontVariant: ["tabular-nums"],
  },
  communityCard: {
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    gap: 14,
    marginTop: 4,
  },
  communityHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  communityTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  communityIconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  communityCardTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: 0.5,
  },
  communityCardSub: {
    fontSize: 10,
    color: "#64748B",
  },
  communityBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  communityBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10B981",
  },
  socialGridRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  socialIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  socialBtnContent: {
    flex: 1,
    justifyContent: "center",
  },
  socialBtnTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F1F5F9",
  },
  socialBtnSub: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },
  vipBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.28)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  vipLeftContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 6,
  },
  vipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  vipTextCol: {
    flex: 1,
    gap: 2,
  },
  vipTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vipTitleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  vipPillBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  vipPillText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#34D399",
  },
  vipSubText: {
    fontSize: 10,
    color: "#94A3B8",
    lineHeight: 14,
  },
});
