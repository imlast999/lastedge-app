import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
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

  // status puede ser null durante el primer fetch
  const safeStatus = status ?? {
    connected: false, uptime: "–", balance: 0, equity: 0, margin: 0, freeMargin: 0,
  };

  const isProfit = dailyPnL >= 0;

  const bottomPad = insets.bottom + 120;

  const handleOpenSettings = () => {
    router.push("/settings-modal" as any);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 16, paddingBottom: bottomPad + 16 },
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
      {/* Safe Area: Header respects top inset */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>LastEdge</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Monitorización del sistema y laboratorio de estrategias
          </Text>
        </View>
        <View style={styles.headerActions}>
          <ConnectionBadge connected={safeStatus.connected} uptime={safeStatus.uptime} />
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={[styles.settingsButton, { backgroundColor: colors.secondary }]}
          >
            <Feather name="settings" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.equityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.equityHeader}>
          <View>
            <Text style={[styles.equityLabel, { color: colors.mutedForeground }]}>{t("equity")}</Text>
            <Text style={[styles.equityValue, { color: colors.foreground }]}>
              {safeStatus.equity.toLocaleString("en", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <Text style={[styles.currencySymbol, { color: colors.mutedForeground }]}> €</Text>
            </Text>
          </View>
          <View style={styles.equityRight}>
            <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>{t("balance")}</Text>
            <Text style={[styles.balanceValue, { color: colors.foreground }]}>
              {safeStatus.balance.toLocaleString("en", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}€
            </Text>
          </View>
        </View>

        <View style={styles.chartContainer}>
          <EquityChart data={equityHistory} height={110} showLabels={false} />
        </View>

        <View style={[styles.chartFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>
            {t("last24h")} · {t("updateEvery5s")}
          </Text>
          <View style={[styles.liveDot, { backgroundColor: colors.profit }]} />
        </View>
      </View>

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

      {safeStatus.executionQuality && (
        <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.accountTitle, { color: colors.foreground }]}>Execution Quality</Text>
          <AccountRow label="Success Rate" value={`${safeStatus.executionQuality.successRate}%`} colors={colors} highlight={safeStatus.executionQuality.successRate >= 95} />
          <AccountRow label="Avg Latency" value={`${safeStatus.executionQuality.avgLatency} ms`} colors={colors} />
          <AccountRow label="Avg Slippage" value={`${safeStatus.executionQuality.avgSlippage} pips`} colors={colors} />
        </View>
      )}

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
  colors: ReturnType<typeof useColors>;
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
  content: { paddingHorizontal: 16, gap: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 12,
  },
  headerCopy: { flex: 1 },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  equityCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  equityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 18,
    paddingBottom: 12,
  },
  equityLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  equityValue: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
    lineHeight: 40,
  },
  currencySymbol: { fontSize: 20, fontFamily: "Inter_400Regular" },
  equityRight: { alignItems: "flex-end", gap: 4 },
  balanceLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  balanceValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"] },
  chartContainer: { paddingHorizontal: 18, paddingBottom: 4 },
  chartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  statsGrid: { flexDirection: "row", gap: 12 },
  accountCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  accountTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  accountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accountLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  accountValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"] },
});
