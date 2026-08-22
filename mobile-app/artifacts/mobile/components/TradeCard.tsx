import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Trade } from "@/context/TradingContext";

interface Props {
  trade: Trade;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function TradeCard({ trade }: Props) {
  const colors = useColors();

  const isProfit = trade.profit > 0;
  const isBuy = trade.type === "BUY";
  const isTP = trade.closeReason === "TAKE_PROFIT";
  const isSL = trade.closeReason === "STOP_LOSS";

  const typeColor = isBuy ? colors.buy : colors.sell;
  const profitColor = isProfit ? colors.profit : colors.loss;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.accent, { backgroundColor: profitColor }]} />
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.left}>
            <View style={styles.symbolRow}>
              <Text style={[styles.symbol, { color: colors.foreground }]}>{trade.symbol}</Text>
              <View style={[styles.typeBadge, { backgroundColor: `${typeColor}20` }]}>
                <Text style={[styles.typeText, { color: typeColor }]}>{trade.type}</Text>
              </View>
            </View>
            <Text style={[styles.date, { color: colors.mutedForeground }]}>
              {formatDate(trade.closedAt)}
            </Text>
          </View>

          <View style={styles.right}>
            <Text style={[styles.profit, { color: profitColor }]}>
              {isProfit ? "+" : ""}{trade.profit.toFixed(2)}€
            </Text>
            <Text style={[styles.pips, { color: colors.mutedForeground }]}>
              {trade.pips > 0 ? "+" : ""}{trade.pips} pips
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Open</Text>
            <Text style={[styles.priceValue, { color: colors.foreground }]}>
              {trade.openPrice.toFixed(trade.symbol.includes("JPY") || trade.symbol.includes("XAU") ? 3 : 5)}
            </Text>
            <Feather name="arrow-right" size={10} color={colors.mutedForeground} />
            <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Close</Text>
            <Text style={[styles.priceValue, { color: colors.foreground }]}>
              {trade.closePrice.toFixed(trade.symbol.includes("JPY") || trade.symbol.includes("XAU") ? 3 : 5)}
            </Text>
          </View>

          {isTP && (
            <View style={[styles.reasonBadge, { backgroundColor: `${colors.profit}20` }]}>
              <Feather name="target" size={10} color={colors.profit} />
              <Text style={[styles.reasonText, { color: colors.profit }]}>TAKE PROFIT</Text>
            </View>
          )}
          {isSL && (
            <View style={[styles.reasonBadge, { backgroundColor: `${colors.loss}20` }]}>
              <Feather name="shield" size={10} color={colors.loss} />
              <Text style={[styles.reasonText, { color: colors.loss }]}>STOP LOSS</Text>
            </View>
          )}
          {!isTP && !isSL && (
            <View style={[styles.reasonBadge, { backgroundColor: `${colors.mutedForeground}20` }]}>
              <Feather name="user" size={10} color={colors.mutedForeground} />
              <Text style={[styles.reasonText, { color: colors.mutedForeground }]}>MANUAL</Text>
            </View>
          )}
        </View>

        {(trade.latencyMs !== undefined || trade.slippagePips !== undefined) && (
          <View style={styles.executionMetrics}>
            {trade.latencyMs !== undefined && (
              <Text style={[styles.metricText, { color: colors.mutedForeground }]}>
                <Feather name="clock" size={10} /> {trade.latencyMs}ms
              </Text>
            )}
            {trade.slippagePips !== undefined && (
              <Text style={[styles.metricText, { color: colors.mutedForeground }]}>
                <Feather name="activity" size={10} /> {trade.slippagePips > 0 ? trade.slippagePips : 0}pips
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 10,
  },
  accent: {
    width: 3,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  left: {
    gap: 4,
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  symbol: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  date: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  profit: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  pips: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  priceLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  priceValue: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
  reasonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reasonText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  executionMetrics: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: -4,
  },
  metricText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    flexDirection: "row",
    alignItems: "center",
  }
});
