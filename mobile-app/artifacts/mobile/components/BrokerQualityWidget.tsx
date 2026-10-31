import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTrading } from "@/context/TradingContext";
import { resolveApiConfig } from "@/lib/apiConfig";

interface ExecutionAnalytics {
  brokerQualityScore: number;
  fillRatePct: number;
  avgLatencyMs: number;
  avgSlippagePips: number;
  totalSlippageCostEur: number;
  totalOrders: number;
}

export function BrokerQualityWidget() {
  const colors = useColors();
  const { currencySymbol } = useTrading();
  const [data, setData] = useState<ExecutionAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchAnalytics() {
      try {
        const { url: baseUrl } = resolveApiConfig();
        const res = await fetch(`${baseUrl}/api/analytics/execution?days=30`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.ok) {
            const raw = json.analytics?.analytics ?? json.analytics ?? json;
            setData({
              brokerQualityScore: Number(raw.broker_quality_score ?? raw.brokerQualityScore ?? 100.0),
              fillRatePct: Number(raw.fill_rate_pct ?? raw.fillRatePct ?? 100.0),
              avgLatencyMs: Number(raw.avg_latency_ms ?? raw.avgLatencyMs ?? 0),
              avgSlippagePips: Number(raw.avg_slippage_pips ?? raw.avgSlippagePips ?? 0),
              totalSlippageCostEur: Number(raw.total_slippage_cost_eur ?? raw.totalSlippageCostEur ?? 0),
              totalOrders: Number(raw.total_orders ?? raw.totalOrders ?? 0),
            });
          }
        }
      } catch (err) {
        // Fallback default structure
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchAnalytics();
    return () => {
      isMounted = false;
    };
  }, []);

  const score = data?.brokerQualityScore ?? 100.0;
  const scoreColor = score >= 80 ? colors.profit : score >= 50 ? colors.pending : colors.loss;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="shield" size={15} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Broker Quality & Latency</Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: `${scoreColor}18`, borderColor: scoreColor }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{score.toFixed(1)} / 100</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      ) : (
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Fill Rate</Text>
            <Text style={[styles.metricValue, { color: colors.profit }]}>
              {(data?.fillRatePct ?? 100).toFixed(1)}%
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Avg Latency</Text>
            <Text style={[styles.metricValue, { color: colors.foreground }]}>
              {data?.avgLatencyMs ?? 0} ms
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Slippage</Text>
            <Text
              style={[
                styles.metricValue,
                { color: (data?.avgSlippagePips ?? 0) <= 0 ? colors.profit : colors.pending },
              ]}
            >
              {(data?.avgSlippagePips ?? 0).toFixed(2)} pips
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Slip Cost</Text>
            <Text
              style={[
                styles.metricValue,
                { color: (data?.totalSlippageCostEur ?? 0) <= 0 ? colors.profit : colors.loss },
              ]}
            >
              {currencySymbol}{(data?.totalSlippageCostEur ?? 0).toFixed(2)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontFamily: "Moderna",
  },
  scoreBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  scoreText: {
    fontSize: 11,
    fontFamily: "Lokeya",
    fontVariant: ["tabular-nums"],
  },
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: "Lokeya",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontFamily: "Lokeya",
    fontVariant: ["tabular-nums"],
  },
});
