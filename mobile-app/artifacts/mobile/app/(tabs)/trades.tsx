/**
 * Pantalla Trades — dos sub-tabs internos:
 *   • Pendientes: señales con status "pending" (requieren acción) +
 *                 señales con status "active" (posición abierta)
 *   • Cerradas:   trades cerrados (WIN / LOSS / BREAKEVEN)
 */
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useTrading } from "@/context/TradingContext";
import { useTranslation } from "@/hooks/useTranslation";
import { SignalCard } from "@/components/SignalCard";
import { TradeCard } from "@/components/TradeCard";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";

type SubTab = "pending" | "closed";

export default function TradesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const {
    signals,
    trades,
    acceptSignal,
    rejectSignal,
    loading,
    refresh,
  } = useTrading();

  const [activeTab, setActiveTab] = useState<SubTab>("pending");

  const bottomPad = insets.bottom + 120;

  const handleOpenSettings = () => {
    router.push("/settings-modal" as any);
  };

  // Pendientes = señales que necesitan acción o ya están abiertas en MT5
  const pendingSignals = useMemo(
    () =>
      [...signals]
        .filter((s) => s.status === "pending" || s.status === "active" || s.status === "executed")
        .sort((a, b) => {
          // Primero "pending" (requieren acción), luego "active"
          if (a.status === "pending" && b.status !== "pending") return -1;
          if (a.status !== "pending" && b.status === "pending") return 1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }),
    [signals]
  );

  // Cerradas: trades con resultado definitivo
  const closedTrades = useMemo(
    () =>
      [...trades].sort(
        (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
      ),
    [trades]
  );

  // Estadísticas para la sub-tab "Cerradas"
  const wins = closedTrades.filter((t) => t.profit > 0).length;
  const losses = closedTrades.filter((t) => t.profit <= 0).length;
  const totalProfit = closedTrades
    .filter((t) => t.profit > 0)
    .reduce((s, t) => s + t.profit, 0);
  const totalLoss = Math.abs(
    closedTrades.filter((t) => t.profit < 0).reduce((s, t) => s + t.profit, 0)
  );
  const profitFactor =
    totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : "∞";
  const totalPnL = closedTrades.reduce((s, t) => s + t.profit, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Safe Area: Header respects top inset (Institutional Breadcrumbs style) */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerCopy}>
          <View style={styles.breadcrumbRow}>
            <Text style={[styles.breadcrumb, { color: colors.primary }]}>MT5 LIVE</Text>
            <Text style={[styles.breadcrumbSep, { color: colors.mutedForeground }]}>/</Text>
            <Text style={[styles.breadcrumb, { color: colors.mutedForeground }]}>EXECUTION</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Trades & Signals</Text>
        </View>
        <TouchableOpacity
          onPress={handleOpenSettings}
          style={[styles.settingsButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="settings" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── Sub-tabs selector ── */}
      <View
        style={[
          styles.subTabBar,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <SubTabButton
          label={t("pendingSignals")}
          badge={pendingSignals.filter((s) => s.status === "pending").length}
          active={activeTab === "pending"}
          onPress={() => setActiveTab("pending")}
          colors={colors}
        />
        <SubTabButton
          label={t("closedTrades")}
          badge={closedTrades.length}
          active={activeTab === "closed"}
          onPress={() => setActiveTab("closed")}
          colors={colors}
        />
      </View>

      {/* ── Contenido: Pendientes ── */}
      {activeTab === "pending" && (
        <FlatList
          data={pendingSignals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SignalCard
              signal={item}
              onAccept={item.status === "pending" ? acceptSignal : undefined}
              onReject={item.status === "pending" ? rejectSignal : undefined}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <ApiErrorBanner />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View
                style={[styles.emptyIcon, { backgroundColor: colors.card }]}
              >
                <Feather name="inbox" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {t("noPendingSignals")}
              </Text>
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                {t("noOpenTrades")}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Contenido: Cerradas ── */}
      {activeTab === "closed" && (
        <FlatList
          data={closedTrades}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TradeCard trade={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <ApiErrorBanner />
              {/* Sumario de estadísticas */}
              {closedTrades.length > 0 && (
                <View
                  style={[
                    styles.summaryCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <SummaryItem
                    label={t("wins")}
                    value={wins.toString()}
                    color={colors.profit}
                    colors={colors}
                  />
                  <View
                    style={[styles.sep, { backgroundColor: colors.border }]}
                  />
                  <SummaryItem
                    label={t("losses")}
                    value={losses.toString()}
                    color={colors.destructive}
                    colors={colors}
                  />
                  <View
                    style={[styles.sep, { backgroundColor: colors.border }]}
                  />
                  <SummaryItem
                    label={t("pnl")}
                    value={`€${totalPnL.toFixed(2)}`}
                    color={totalPnL >= 0 ? colors.profit : colors.destructive}
                    colors={colors}
                  />
                  <View
                    style={[styles.sep, { backgroundColor: colors.border }]}
                  />
                  <SummaryItem
                    label={t("profitFactor")}
                    value={profitFactor}
                    color={
                      parseFloat(profitFactor) >= 1.5
                        ? colors.profit
                        : colors.foreground
                    }
                    colors={colors}
                  />
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View
                style={[styles.emptyIcon, { backgroundColor: colors.card }]}
              >
                <Feather name="clock" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {t("noClosedTrades")}
              </Text>
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                {t("closedTradesSummary")}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SubTabButton({
  label,
  badge,
  active,
  onPress,
  colors,
}: {
  label: string;
  badge: number;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.subTab,
        active && {
          borderBottomWidth: 2,
          borderBottomColor: colors.primary,
        },
      ]}
    >
      <View style={styles.subTabInner}>
        <Text
          style={[
            styles.subTabLabel,
            {
              color: active ? colors.primary : colors.mutedForeground,
              fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
            },
          ]}
        >
          {label}
        </Text>
        {badge > 0 && (
          <View
            style={[styles.subTabBadge, { backgroundColor: colors.pending }]}
          >
            <Text style={[styles.subTabBadgeText, { color: "#09090b" }]}>
              {badge}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SummaryItem({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerCopy: { flex: 1, gap: 2 },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  breadcrumb: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  breadcrumbSep: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Sub-tab bar
  subTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  subTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  subTabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subTabLabel: {
    fontSize: 13,
  },
  subTabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  subTabBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },

  // Listas
  list: { paddingHorizontal: 16, paddingTop: 4 },
  listHeader: { marginBottom: 4 },

  // Sumario cerradas
  summaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 12,
    marginBottom: 10,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 3 },
  summaryValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sep: { width: 1, marginVertical: 2 },

  // Empty states
  empty: { alignItems: "center", paddingTop: 48, gap: 10 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
