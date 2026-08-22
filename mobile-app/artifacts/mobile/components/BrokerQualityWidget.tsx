import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { getApiUrl } from "@/services/connectionTest";

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
  const [data, setData] = useState<ExecutionAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchAnalytics() {
      try {
        const baseUrl = await getApiUrl();
        const res = await fetch(`${baseUrl}/api/analytics/execution?days=30`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.ok) {
            setData(json);
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
  const scoreColor = score >= 80 ? "#3fb950" : score >= 50 ? "#d29922" : "#f85149";

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="shield" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Broker Quality & Latency</Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: `${scoreColor}22`, borderColor: scoreColor }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{score.toFixed(1)} / 100</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      ) : (
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Fill Rate</Text>
            <Text style={[styles.metricValue, { color: "#3fb950" }]}>
              {(data?.fillRatePct ?? 100).toFixed(1)}%
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Avg Latency</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {data?.avgLatencyMs ?? 0} ms
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Slippage</Text>
            <Text style={[styles.metricValue, { color: (data?.avgSlippagePips ?? 0) <= 0 ? "#3fb950" : "#d29922" }]}>
              {(data?.avgSlippagePips ?? 0).toFixed(2)} pips
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Slip Cost</Text>
            <Text style={[styles.metricValue, { color: (data?.totalSlippageCostEur ?? 0) <= 0 ? "#3fb950" : "#f85149" }]}>
              {(data?.totalSlippageCostEur ?? 0).toFixed(2)} €
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: "800",
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
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
  },
});
