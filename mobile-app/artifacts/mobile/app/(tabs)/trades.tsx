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
import { useTrading, Position, Signal } from "@/context/TradingContext";
import { useSettings } from "@/context/SettingsContext";
import { SignalCard } from "@/components/SignalCard";
import { TradeCard } from "@/components/TradeCard";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { TradeFlowModal, TradeFlowTarget } from "@/components/TradeFlowModal";

type SubTab = "open" | "pending" | "closed";

export default function TradesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();
  const isEs = settings.language === "es";

  const {
    signals,
    positions,
    trades,
    acceptSignal,
    rejectSignal,
    currencySymbol,
    loading,
    refresh,
  } = useTrading();

  const [activeTab, setActiveTab] = useState<SubTab>("open");
  const [flowTarget, setFlowTarget] = useState<TradeFlowTarget | null>(null);

  const bottomPad = insets.bottom + 120;

  const handleOpenSettings = () => {
    router.push("/settings-modal" as any);
  };

  // 1. Operaciones abiertas (posiciones reales MT5 o señales activas)
  const openTrades = useMemo(() => {
    if (positions && positions.length > 0) {
      return positions;
    }
    // Fallback si MT5 reporta posiciones como señales activas
    const activeSignals = signals.filter(
      (s) => s.status === "active" || s.status === "executed"
    );
    return activeSignals.map((s, idx) => ({
      ticket: 10000000 + idx,
      symbol: s.symbol,
      type: s.type,
      volume: s.lot || 0.01,
      open_price: s.entry,
      current_price: s.entry,
      sl: s.stopLoss,
      tp: s.takeProfit,
      profit: 0.0,
      time: s.timestamp,
    }));
  }, [positions, signals]);

  // 2. Operaciones por aceptar (señales pending)
  const pendingSignals = useMemo(
    () => signals.filter((s) => s.status === "pending"),
    [signals]
  );

  // 3. Operaciones ya expiradas (señales expired)
  const expiredSignals = useMemo(
    () => signals.filter((s) => s.status === "expired" || s.status === "rejected"),
    [signals]
  );

  // 4. Operaciones cerradas
  const closedTrades = useMemo(
    () =>
      [...trades].sort(
        (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
      ),
    [trades]
  );

  // Estadísticas para "Cerradas"
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
      {/* Safe Area Header */}
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

      {/* ── Sub-tabs selector: 3 secciones solicitadas ── */}
      <View
        style={[
          styles.subTabBar,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <SubTabButton
          label={isEs ? "Abiertas" : "Open"}
          badge={openTrades.length}
          active={activeTab === "open"}
          onPress={() => setActiveTab("open")}
          colors={colors}
        />
        <SubTabButton
          label={isEs ? "Por aceptar" : "To Accept"}
          badge={pendingSignals.length}
          active={activeTab === "pending"}
          onPress={() => setActiveTab("pending")}
          colors={colors}
        />
        <SubTabButton
          label={isEs ? "Cerradas" : "Closed"}
          badge={closedTrades.length}
          active={activeTab === "closed"}
          onPress={() => setActiveTab("closed")}
          colors={colors}
        />
      </View>

      {/* ── SUB-TAB 1: OPERACIONES ABIERTAS ── */}
      {activeTab === "open" && (
        <FlatList
          data={openTrades}
          keyExtractor={(item) => String(item.ticket)}
          renderItem={({ item }) => (
            <OpenPositionCard
              pos={item}
              colors={colors}
              isEs={isEs}
              currencySymbol={currencySymbol}
              onViewFlow={() =>
                setFlowTarget({
                  type: "position",
                  ticket: item.ticket,
                  symbol: item.symbol,
                })
              }
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
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
              <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
                <Feather name="shield" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {isEs ? "0 operaciones abiertas" : "0 open positions"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isEs
                  ? "Risk Engine v2 activo · 100% margen libre sin riesgo flotante"
                  : "Risk Engine v2 active · 100% free margin with no floating exposure"}
              </Text>
            </View>
          }
        />
      )}

      {/* ── SUB-TAB 2: OPERACIONES POR ACEPTAR (CON EXPIRADAS ABAJO) ── */}
      {activeTab === "pending" && (
        <FlatList
          data={pendingSignals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SignalCard
              signal={item}
              onAccept={acceptSignal}
              onReject={rejectSignal}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
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
              <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
                <Feather name="inbox" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {isEs ? "No hay señales por aceptar" : "No pending signals"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isEs
                  ? "El escáner de mercado publicará nuevas señales automáticamente."
                  : "Market scanner will broadcast new signals automatically."}
              </Text>
            </View>
          }
          ListFooterComponent={
            expiredSignals.length > 0 ? (
              <View style={styles.expiredSection}>
                <View style={styles.expiredHeaderRow}>
                  <Feather name="clock" size={13} color="#94a3b8" />
                  <Text style={[styles.expiredSectionTitle, { color: "#94a3b8" }]}>
                    {isEs ? "Operaciones Expiradas" : "Expired Signals"} ({expiredSignals.length})
                  </Text>
                </View>
                {expiredSignals.map((sig) => (
                  <View
                    key={sig.id}
                    style={[
                      styles.expiredCard,
                      { backgroundColor: colors.card, borderColor: "rgba(255,255,255,0.06)" },
                    ]}
                  >
                    <View style={styles.expiredCardTop}>
                      <Text style={[styles.expiredSymbol, { color: colors.foreground }]}>
                        {sig.symbol}
                      </Text>
                      <View style={[styles.expiredBadge, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
                        <Text style={styles.expiredBadgeText}>
                          {sig.status === "rejected" ? (isEs ? "RECHAZADA" : "REJECTED") : (isEs ? "EXPIRADA" : "EXPIRED")}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.expiredDetail}>
                      {sig.type} {sig.lot}L · Entrada: {sig.entry} · SL: {sig.stopLoss} · TP: {sig.takeProfit}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      )}

      {/* ── SUB-TAB 3: OPERACIONES CERRADAS ── */}
      {activeTab === "closed" && (
        <FlatList
          data={closedTrades}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TradeCard trade={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
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
              {closedTrades.length > 0 && (
                <View
                  style={[
                    styles.summaryCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <SummaryItem
                    label={isEs ? "Aciertos" : "Wins"}
                    value={wins.toString()}
                    color={colors.profit}
                    colors={colors}
                  />
                  <View style={[styles.sep, { backgroundColor: colors.border }]} />
                  <SummaryItem
                    label={isEs ? "Fallos" : "Losses"}
                    value={losses.toString()}
                    color={colors.destructive}
                    colors={colors}
                  />
                  <View style={[styles.sep, { backgroundColor: colors.border }]} />
                  <SummaryItem
                    label={isEs ? "P&L Total" : "Total P&L"}
                    value={`${currencySymbol}${totalPnL.toFixed(2)}`}
                    color={totalPnL >= 0 ? colors.profit : colors.destructive}
                    colors={colors}
                  />
                  <View style={[styles.sep, { backgroundColor: colors.border }]} />
                  <SummaryItem
                    label={isEs ? "Profit Factor" : "Profit Factor"}
                    value={profitFactor}
                    color={parseFloat(profitFactor) >= 1.3 ? colors.profit : colors.foreground}
                    colors={colors}
                  />
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
                <Feather name="archive" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {isEs ? "No hay operaciones cerradas" : "No closed trades"}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal interactivo de flujo en tiempo real */}
      <TradeFlowModal
        visible={!!flowTarget}
        target={flowTarget}
        onClose={() => setFlowTarget(null)}
      />
    </View>
  );
}

// ── Tarjeta de Operación Abierta con botón para ver flujo en vivo ─────────────

function OpenPositionCard({
  pos,
  colors,
  isEs,
  currencySymbol,
  onViewFlow,
}: {
  pos: Position | any;
  colors: any;
  isEs: boolean;
  currencySymbol: string;
  onViewFlow: () => void;
}) {
  const isProfit = (pos.profit ?? 0) >= 0;
  const pSign = isProfit ? "+" : "";
  const isBuy = pos.type === "BUY";

  return (
    <View style={[styles.posCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.posHeader}>
        <View style={styles.posHeaderLeft}>
          <Text style={[styles.posSymbol, { color: colors.foreground }]}>{pos.symbol}</Text>
          <View
            style={[
              styles.posTypeBadge,
              { backgroundColor: isBuy ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)" },
            ]}
          >
            <Text style={[styles.posTypeText, { color: isBuy ? "#10b981" : "#ef4444" }]}>
              {pos.type} {pos.volume || pos.lot || 0.01}L
            </Text>
          </View>
          <Text style={styles.posTicket}>#{pos.ticket}</Text>
        </View>

        <View
          style={[
            styles.posPnlBadge,
            { backgroundColor: isProfit ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" },
          ]}
        >
          <Text style={[styles.posPnlText, { color: isProfit ? "#10b981" : "#ef4444" }]}>
            {pSign}${parseFloat(pos.profit ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Telemetry Row */}
      <View style={styles.posMetricsRow}>
        <View style={styles.posMetric}>
          <Text style={styles.posMetricLabel}>{isEs ? "Entrada" : "Entry"}</Text>
          <Text style={[styles.posMetricValue, { color: colors.foreground }]}>
            {(pos.open_price ?? pos.entry ?? 0).toFixed(5)}
          </Text>
        </View>
        <View style={styles.posMetric}>
          <Text style={styles.posMetricLabel}>Stop Loss</Text>
          <Text style={[styles.posMetricValue, { color: "#ef4444" }]}>
            {(pos.sl ?? 0).toFixed(5)}
          </Text>
        </View>
        <View style={styles.posMetric}>
          <Text style={styles.posMetricLabel}>Take Profit</Text>
          <Text style={[styles.posMetricValue, { color: "#38bdf8" }]}>
            {(pos.tp ?? 0).toFixed(5)}
          </Text>
        </View>
        <View style={styles.posMetric}>
          <Text style={styles.posMetricLabel}>{isEs ? "Actual" : "Current"}</Text>
          <Text style={[styles.posMetricValue, { color: "#00ff88" }]}>
            {(pos.current_price ?? pos.open_price ?? 0).toFixed(5)}
          </Text>
        </View>
      </View>

      {/* Action Button: Ver cómo fluye la operación */}
      <View style={styles.posActionRow}>
        <TouchableOpacity style={styles.viewFlowButton} onPress={onViewFlow} activeOpacity={0.8}>
          <Feather name="activity" size={14} color="#00ff88" />
          <Text style={styles.viewFlowButtonText}>
            {isEs ? "Ver cómo fluye la operación" : "Watch Trade Flow Live"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Botón de Sub-tab ──────────────────────────────────────────────────────────

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
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.subTab,
        active && { borderBottomWidth: 2, borderBottomColor: colors.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.subTabInner}>
        <Text
          style={[
            styles.subTabLabel,
            {
              color: active ? colors.foreground : colors.mutedForeground,
              fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
            },
          ]}
        >
          {label}
        </Text>
        {badge > 0 && (
          <View
            style={[
              styles.subTabBadge,
              { backgroundColor: active ? colors.primary : colors.muted },
            ]}
          >
            <Text
              style={[
                styles.subTabBadgeText,
                { color: active ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {badge}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Elemento de sumario ───────────────────────────────────────────────────────

function SummaryItem({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: any;
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
    fontSize: 12,
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

  // Tarjeta de Posición Abierta
  posCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  posHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  posHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  posSymbol: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  posTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  posTypeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  posTicket: {
    fontSize: 11,
    color: "#94a3b8",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  posPnlBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  posPnlText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  posMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  posMetric: {
    alignItems: "center",
    gap: 2,
  },
  posMetricLabel: {
    fontSize: 9,
    color: "#94a3b8",
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
  },
  posMetricValue: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "600",
  },
  posActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  viewFlowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,255,136,0.1)",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewFlowButtonText: {
    color: "#00ff88",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Sección de Expiradas
  expiredSection: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 14,
    gap: 8,
  },
  expiredHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  expiredSectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  expiredCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    opacity: 0.65,
  },
  expiredCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  expiredSymbol: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  expiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiredBadgeText: {
    fontSize: 9,
    color: "#ef4444",
    fontFamily: "Inter_700Bold",
  },
  expiredDetail: {
    fontSize: 11,
    color: "#94a3b8",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

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
