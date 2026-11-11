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
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useTrading, Position, Signal } from "@/context/TradingContext";
import { useSettings } from "@/context/SettingsContext";
import { SignalCard } from "@/components/SignalCard";
import { TradeCard } from "@/components/TradeCard";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { TradeFlowModal, TradeFlowTarget } from "@/components/TradeFlowModal";

type SubTab = "open" | "pending" | "closed";

function formatPrice(val?: number, sym?: string): string {
  if (val == null || isNaN(val)) return "-";
  const num = Number(val);
  const digits = (sym?.includes("JPY") || sym?.includes("XAU")) ? 3 : (sym?.includes("BTC") ? 2 : 5);
  return num.toFixed(digits);
}

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

  const handleTabChange = (tab: SubTab) => {
    if (Platform.OS !== "web" && settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setActiveTab(tab);
  };

  const handleOpenSettings = () => {
    router.push("/settings-modal" as any);
  };

  // 1. Operaciones abiertas (posiciones reales MT5)
  const openTrades = useMemo(() => {
    return Array.isArray(positions) ? positions : [];
  }, [positions]);

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
            <Text style={[styles.breadcrumb, { color: colors.mutedForeground }]}>{isEs ? "EJECUCIÓN" : "EXECUTION"}</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{isEs ? "Operaciones & Señales" : "Trades & Signals"}</Text>
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
          onPress={() => handleTabChange("open")}
          colors={colors}
        />
        <SubTabButton
          label={isEs ? "Por aceptar" : "To Accept"}
          badge={pendingSignals.length}
          active={activeTab === "pending"}
          onPress={() => handleTabChange("pending")}
          colors={colors}
        />
        <SubTabButton
          label={isEs ? "Cerradas" : "Closed"}
          badge={closedTrades.length}
          active={activeTab === "closed"}
          onPress={() => handleTabChange("closed")}
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
                      {sig.type} {Number(sig.lot ?? 0.01).toFixed(2)}L · {isEs ? "Entrada" : "Entry"}: {formatPrice(sig.entry, sig.symbol)} · SL: {formatPrice(sig.stopLoss, sig.symbol)} · TP: {formatPrice(sig.takeProfit, sig.symbol)}
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

  const entry = Number(pos.open_price ?? pos.entry ?? 0);
  const sl = Number(pos.sl ?? 0);
  const tp = Number(pos.tp ?? 0);
  const current = Number(pos.current_price ?? entry);
  const profitVal = parseFloat(pos.profit ?? 0);

  const isJpyOrXau = pos.symbol?.includes("JPY") || pos.symbol?.includes("XAU");
  const isCrypto = pos.symbol?.includes("BTC") || pos.symbol?.includes("ETH");
  const digits = isJpyOrXau ? 3 : (isCrypto ? 2 : 5);

  const isBeCovered = isBuy ? (sl > 0 && sl >= entry - 0.0001) : (sl > 0 && sl <= entry + 0.0001);
  const commentHasBe = Boolean(
    pos.comment?.toUpperCase().includes("BE") ||
    pos.comment?.toUpperCase().includes("BREAK") ||
    pos.comment?.toUpperCase().includes("TRAILING") ||
    pos.comment?.toUpperCase().includes("RATCHET")
  );
  const isBeLocked = isBeCovered || commentHasBe;

  const initialRiskDist = sl > 0 ? Math.abs(entry - sl) : 0;
  let targetR = 3.0;
  let lockedR = 0.2;

  if (initialRiskDist > 0) {
    if (tp > 0) {
      const tpDist = Math.abs(tp - entry);
      targetR = Math.max(1.0, Math.min(8.0, tpDist / initialRiskDist));
    }
    if (isBeCovered && sl > 0) {
      const coveredDist = isBuy ? (sl - entry) : (entry - sl);
      if (coveredDist > 0) {
        lockedR = Math.max(0.1, coveredDist / initialRiskDist);
      }
    }
  }

  return (
    <View style={[styles.posCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.posHeader}>
        <View style={styles.posHeaderLeft}>
          <Text style={[styles.posSymbol, { color: colors.foreground }]}>{pos.symbol}</Text>
          <View
            style={[
              styles.posTypeBadge,
              { backgroundColor: isBuy ? "rgba(59,130,246,0.18)" : "rgba(244,63,94,0.18)" },
            ]}
          >
            <Text style={[styles.posTypeText, { color: isBuy ? "#3B82F6" : "#F43F5E" }]}>
              {pos.type} {pos.volume || pos.lot || 0.01} LOT
            </Text>
          </View>
          <Text style={styles.posTicket}>#{pos.ticket}</Text>
        </View>

        <View style={styles.posHeaderRight}>
          {isBeLocked && (
            <View style={styles.beBadge}>
              <Feather name="shield" size={11} color="#3B82F6" />
              <Text style={styles.beBadgeText}>BE LOCKED (+{lockedR.toFixed(1)}R)</Text>
            </View>
          )}
          <View
            style={[
              styles.posPnlBadge,
              { backgroundColor: isProfit ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" },
            ]}
          >
            <Text style={[styles.posPnlText, { color: isProfit ? "#10b981" : "#ef4444" }]}>
              {pSign}${profitVal.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Visual Risk/Reward Projection Bar (Room Tour Step 2) */}
      <View style={styles.rrVisualBar}>
        <View style={[styles.rrSegment, { flex: 1, backgroundColor: "rgba(239, 68, 68, 0.45)" }]}>
          <Text style={styles.rrSegmentText}>SL -1.0R</Text>
        </View>
        <View
          style={[
            styles.rrSegment,
            {
              flex: 0.25,
              backgroundColor: isBeLocked ? "rgba(59, 130, 246, 0.85)" : "rgba(100, 116, 139, 0.35)",
            },
          ]}
        >
          <Text style={[styles.rrSegmentText, { color: isBeLocked ? "#FFFFFF" : "#94A3B8" }]}>BE</Text>
        </View>
        <View style={[styles.rrSegment, { flex: targetR, backgroundColor: "rgba(16, 185, 129, 0.45)" }]}>
          <Text style={styles.rrSegmentText}>TP +{targetR.toFixed(1)}R</Text>
        </View>
      </View>

      {/* Ratchet SL Monotonic Sub-bar */}
      <View style={styles.ratchetFooterBar}>
        <View style={styles.ratchetLeft}>
          <Feather name="crosshair" size={12} color="#94A3B8" />
          <Text style={styles.ratchetText}>
            Ratchet SL: {sl > 0 ? sl.toFixed(digits) : (isEs ? "Sin SL" : "No SL")}
          </Text>
        </View>
        <View style={styles.ratchetRight}>
          {isBeLocked ? (
            <View style={styles.lockedPill}>
              <Feather name="lock" size={10} color="#3B82F6" />
              <Text style={styles.lockedText}>Monotonic Locked</Text>
            </View>
          ) : (
            <Text style={[styles.ratchetStatus, { color: isProfit ? "#10B981" : "#94A3B8" }]}>
              {isProfit ? (isEs ? "En Beneficio" : "In Profit") : (isEs ? "Riesgo Activo" : "Active Risk")}
            </Text>
          )}
        </View>
      </View>

      {/* Telemetry Row */}
      <View style={styles.posMetricsRow}>
        <View style={styles.posMetric}>
          <Text style={styles.posMetricLabel}>{isEs ? "Entrada" : "Entry"}</Text>
          <Text style={[styles.posMetricValue, { color: colors.foreground }]}>
            {entry.toFixed(digits)}
          </Text>
        </View>
        <View style={styles.posMetric}>
          <Text style={styles.posMetricLabel}>Stop Loss</Text>
          <Text style={[styles.posMetricValue, { color: "#ef4444" }]}>
            {sl > 0 ? sl.toFixed(digits) : "—"}
          </Text>
        </View>
        <View style={styles.posMetric}>
          <Text style={styles.posMetricLabel}>Take Profit</Text>
          <Text style={[styles.posMetricValue, { color: "#38bdf8" }]}>
            {tp > 0 ? tp.toFixed(digits) : "—"}
          </Text>
        </View>
        <View style={styles.posMetric}>
          <Text style={styles.posMetricLabel}>{isEs ? "Actual" : "Current"}</Text>
          <Text style={[styles.posMetricValue, { color: "#00ff88" }]}>
            {current.toFixed(digits)}
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
              fontFamily: "PlusJakartaSans_500Medium",
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
    fontFamily: "PlusJakartaSans_500Medium",
    letterSpacing: 0.6,
  },
  breadcrumbSep: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  title: { fontSize: 20, fontFamily: "Nexa" },
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
    fontFamily: "PlusJakartaSans_500Medium",
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
    fontFamily: "PlusJakartaSans_500Medium",
  },
  posTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  posTypeText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
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
    fontFamily: "PlusJakartaSans_500Medium",
  },
  posHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  beBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
  },
  beBadgeText: {
    color: "#3B82F6",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  rrVisualBar: {
    flexDirection: "row",
    height: 22,
    borderRadius: 6,
    overflow: "hidden",
    marginVertical: 8,
    gap: 2,
  },
  rrSegment: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 3,
  },
  rrSegmentText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  ratchetFooterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  ratchetLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ratchetText: {
    color: "#94a3b8",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "600",
  },
  ratchetRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lockedText: {
    color: "#3B82F6",
    fontSize: 10,
    fontWeight: "700",
  },
  ratchetStatus: {
    fontSize: 10,
    fontWeight: "600",
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
    fontFamily: "PlusJakartaSans_500Medium",
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
    fontFamily: "PlusJakartaSans_500Medium",
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
    fontFamily: "Nexa",
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
    fontFamily: "PlusJakartaSans_500Medium",
  },
  expiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiredBadgeText: {
    fontSize: 9,
    color: "#ef4444",
    fontFamily: "PlusJakartaSans_500Medium",
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
    fontFamily: "PlusJakartaSans_500Medium",
    fontVariant: ["tabular-nums"],
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: "PlusJakartaSans_500Medium",
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
  emptyTitle: { fontSize: 15, fontFamily: "Nexa" },
  emptyText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
