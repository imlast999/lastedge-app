import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { status, equityHistory, dailyPnL, winrate, openPositions, pendingSignals, loading, refresh } =
    useTrading();

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
          <View style={[styles.avatarBox, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>L</Text>
          </View>
          <View style={styles.workspaceMeta}>
            <Text style={[styles.workspaceTitle, { color: colors.foreground }]}>
              MT5 Live Account
            </Text>
            <Text style={[styles.workspaceSub, { color: colors.mutedForeground }]}>
              {safeStatus.connected ? "Production · Online" : "Production · Offline"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <ConnectionBadge connected={safeStatus.connected} uptime={safeStatus.uptime} />
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={[styles.settingsButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="settings" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Institutional MT5 Balance & Equity Card (line-charts.tsx style) */}
      <View style={[styles.equityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.equityHeader}>
          <View style={styles.equityLeft}>
            <Text style={[styles.equityLabel, { color: colors.mutedForeground }]}>
              MT5 {t("equity")}
            </Text>
            <Text style={[styles.equityValue, { color: colors.foreground }]}>
              {safeStatus.equity.toLocaleString("en", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <Text style={[styles.currencySymbol, { color: colors.mutedForeground }]}> €</Text>
            </Text>
          </View>

          <View style={styles.equityRight}>
            <View
              style={[
                styles.floatingBadge,
                {
                  backgroundColor: floatingPnL >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                },
              ]}
            >
              <Text
                style={[
                  styles.floatingText,
                  { color: floatingPnL >= 0 ? colors.profit : colors.loss },
                ]}
              >
                {floatingPnL >= 0 ? "+" : ""}
                {floatingPnL.toFixed(2)}€ Float
              </Text>
            </View>
            <Text style={[styles.balanceValue, { color: colors.mutedForeground }]}>
              Bal: {safeStatus.balance.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </Text>
          </View>
        </View>

        {/* Equity Chart with Cartesian Grid & Precision Labels */}
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
          value={`${isProfit ? "+" : ""}${dailyPnL.toFixed(2)}€`}
          icon="trending-up"
          trend={isProfit ? "up" : "down"}
          accent={isProfit ? colors.profit : colors.loss}
          subValue={isProfit ? t("inProfit") : t("inLoss")}
        />
        <StatsCard
          label={t("winrate")}
          value={`${winrate}%`}
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
              <Text style={styles.bentoCardTitle}>TELEMETRÍA DE MARGEN & CAPITAL</Text>
              <Text style={styles.bentoCardSub}>Controles de Liquidez y Solvencia MT5</Text>
            </View>
          </View>
          <View style={styles.bentoBadge}>
            <Text style={styles.bentoBadgeText}>INSTITUTIONAL</Text>
          </View>
        </View>

        {/* 1. Margen Libre Indicator */}
        <View style={styles.indicatorBlock}>
          <View style={styles.indicatorHeader}>
            <Text style={styles.indicatorLabel}>Margen Libre Disponible</Text>
            <Text style={styles.indicatorValue}>
              {safeStatus.freeMargin.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€{" "}
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
            <Text style={styles.indicatorLabel}>Equidad vs Balance</Text>
            <Text style={styles.indicatorValue}>
              {safeStatus.equity.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€{" "}
              <Text style={{ color: floatingPnL >= 0 ? "#34D399" : "#F87171", fontSize: 11, fontWeight: "700" }}>
                ({floatingPnL >= 0 ? "+" : ""}{floatingPnL.toFixed(2)}€ Float)
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
                <Text style={styles.indicatorLabel}>Nivel de Margen (Margin Level)</Text>
                <Text style={[styles.indicatorValue, { color: lvlColor }]}>
                  {safeStatus.margin > 0 ? `${marginLvl.toFixed(0)}%` : "Infinito (Sin margen usado)"}
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
                <Text style={styles.indicatorScaleText}>Crítico: &lt;200%</Text>
                <Text style={styles.indicatorScaleText}>Precaución: 500%</Text>
                <Text style={styles.indicatorScaleText}>Excelente: &gt;1000%</Text>
              </View>
            </View>
          );
        })()}
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
    marginBottom: 4,
  },
  workspaceProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  workspaceMeta: {
    flexDirection: "column",
  },
  workspaceTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 16,
  },
  workspaceSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
  headerActions: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
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
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  equityValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  currencySymbol: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  balanceValue: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
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
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_500Medium",
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
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  accountValue: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
});
