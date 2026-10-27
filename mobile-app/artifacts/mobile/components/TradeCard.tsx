import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTrading } from "@/context/TradingContext";
import type { Trade } from "@/context/TradingContext";

interface Props {
  trade: Trade;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return (
      d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) +
      " · " +
      d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return isoString;
  }
}

export function TradeCard({ trade }: Props) {
  const colors = useColors();
  const { currencySymbol } = useTrading();

  const profitVal = Number(trade?.profit ?? 0);
  const pipsVal = Number(trade?.pips ?? 0);
  const openPriceVal = Number(trade?.openPrice ?? 0);
  const closePriceVal = Number(trade?.closePrice ?? 0);
  const symbolStr = trade?.symbol || "–";
  const isProfit = profitVal >= 0;
  const isBuy = trade?.type === "BUY";
  const isTP = trade?.closeReason === "TAKE_PROFIT";
  const isSL = trade?.closeReason === "STOP_LOSS";

  const typeColor = isBuy ? "#3B82F6" : "#F43F5E";
  const profitColor = isProfit ? "#10B981" : "#EF4444";

  return (
    <View style={styles.card}>
      {/* Top Header */}
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.symbolRow}>
            <Text style={styles.symbol}>{symbolStr}</Text>
            <View style={[styles.typeBadge, { backgroundColor: `${typeColor}20` }]}>
              <Text style={[styles.typeText, { color: typeColor }]}>
                {trade?.type || "BUY"}
              </Text>
            </View>
            <View style={styles.lotBadge}>
              <Text style={styles.lotText}>{Number(trade?.lot ?? 0.01).toFixed(2)} lot</Text>
            </View>
          </View>
          <Text style={styles.date}>
            {formatDate(trade?.closedAt || new Date().toISOString())}
          </Text>
        </View>

        {/* PnL Right Pill */}
        <View style={styles.right}>
          <Text style={[styles.profit, { color: profitColor }]}>
            {isProfit ? "+" : ""}
            {currencySymbol}{profitVal.toFixed(2)}
          </Text>
          <Text style={styles.pips}>
            {pipsVal >= 0 ? "+" : ""}
            {pipsVal.toFixed(1)} pips
          </Text>
        </View>
      </View>

      {/* Execution Price Flow */}
      <View style={styles.footer}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>In:</Text>
          <Text style={styles.priceValue}>
            {openPriceVal.toFixed(
              symbolStr.includes("JPY") || symbolStr.includes("XAU") ? 3 : 5
            )}
          </Text>
          <Feather name="arrow-right" size={11} color="#64748B" />
          <Text style={styles.priceLabel}>Out:</Text>
          <Text style={styles.priceValue}>
            {closePriceVal.toFixed(
              symbolStr.includes("JPY") || symbolStr.includes("XAU") ? 3 : 5
            )}
          </Text>
        </View>

        {isTP && (
          <View style={[styles.reasonBadge, styles.reasonBadgeTP]}>
            <Feather name="target" size={10} color="#10B981" />
            <Text style={[styles.reasonText, { color: "#34D399" }]}>TAKE PROFIT</Text>
          </View>
        )}
        {isSL && (
          <View style={[styles.reasonBadge, styles.reasonBadgeSL]}>
            <Feather name="shield" size={10} color="#EF4444" />
            <Text style={[styles.reasonText, { color: "#F87171" }]}>STOP LOSS</Text>
          </View>
        )}
        {!isTP && !isSL && (
          <View style={[styles.reasonBadge, styles.reasonBadgeManual]}>
            <Feather name="user" size={10} color="#94A3B8" />
            <Text style={[styles.reasonText, { color: "#CBD5E1" }]}>MANUAL</Text>
          </View>
        )}
      </View>

      {(trade.latencyMs !== undefined || trade.slippagePips !== undefined) && (
        <View style={styles.executionMetrics}>
          {trade.latencyMs !== undefined && (
            <Text style={styles.metricText}>
              <Feather name="clock" size={10} /> {trade.latencyMs}ms latencia
            </Text>
          )}
          {trade.slippagePips !== undefined && (
            <Text style={styles.metricText}>
              <Feather name="activity" size={10} /> {trade.slippagePips} pips deslizamiento
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    marginBottom: 10,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  left: {
    gap: 4,
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  symbol: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: 0.3,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  lotBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  lotText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    fontVariant: ["tabular-nums"],
  },
  date: {
    fontSize: 11,
    color: "#64748B",
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  profit: {
    fontSize: 17,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  pips: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  priceLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E2E8F0",
    fontVariant: ["tabular-nums"],
  },
  reasonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  reasonBadgeTP: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  reasonBadgeSL: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  reasonBadgeManual: {
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  reasonText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  executionMetrics: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 4,
  },
  metricText: {
    fontSize: 10,
    color: "#64748B",
  },
});
