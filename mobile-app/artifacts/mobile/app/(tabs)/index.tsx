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

      {/* MT5 Account Margin Telemetry */}
      <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.accountTitle, { color: colors.foreground }]}>{t("mt5Account")}</Text>
        <AccountRow label={t("marginUsed")} value={`${safeStatus.margin.toFixed(2)}€`} colors={colors} />
        <AccountRow label={t("freeMargin")} value={`${safeStatus.freeMargin.toFixed(2)}€`} colors={colors} />
        <AccountRow
          label={t("marginLevel")}
          value={safeStatus.margin > 0 ? `${((safeStatus.equity / safeStatus.margin) * 100).toFixed(0)}%` : "–"}
          colors={colors}
          highlight={safeStatus.margin > 0 && safeStatus.equity / safeStatus.margin > 10}
        />
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
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
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
  accountCard: {
    borderRadius: 8,
    borderWidth: 1,
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
