import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { resolveApiConfig } from "@/lib/apiConfig";
import { useSettings } from "@/context/SettingsContext";

interface OpenPositionRisk {
  symbol: string;
  ticket: number;
  volume: number;
  risk_pct: number;
  risk_amount: number;
  has_sl: boolean;
}

interface SymbolEstimation {
  lot: number;
  approved: boolean;
  reason: string;
}

interface CircuitBreakerStatus {
  can_trade?: boolean;
  status?: string;
  is_tripped?: boolean;
  reason?: string;
}

interface RiskDashboardData {
  can_trade?: boolean;
  circuit_breaker?: CircuitBreakerStatus;
  balance: number;
  equity: number;
  free_margin: number;
  margin: number;
  margin_level: number;
  portfolio_risk_pct: number;
  max_portfolio_risk_pct: number;
  remaining_capacity_pct: number;
  open_positions: OpenPositionRisk[];
  estimations: Record<string, SymbolEstimation>;
  timestamp: string;
}

export default function RiskWidget() {
  const colors = useColors();
  const { apiOverrides } = useSettings();
  const [data, setData] = useState<RiskDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRiskData = useCallback(async () => {
    try {
      const { url: apiUrl, token: apiSecret } = resolveApiConfig(apiOverrides);
      if (!apiUrl) return;

      const res = await fetch(`${apiUrl}/api/risk-dashboard`, {
        headers: apiSecret
          ? {
              Authorization: `Bearer ${apiSecret}`,
              "X-Api-Key": apiSecret,
            }
          : {},
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.warn("Error fetching risk dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, [apiOverrides]);

  useEffect(() => {
    fetchRiskData();
    const interval = setInterval(fetchRiskData, 8000);
    return () => clearInterval(interval);
  }, [fetchRiskData]);

  if (loading && !data) {
    return (
      <View style={[styles.card, { justifyContent: "center", minHeight: 120 }]}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  }

  const safeData = {
    can_trade: data?.can_trade ?? data?.circuit_breaker?.can_trade ?? true,
    circuit_breaker: data?.circuit_breaker ?? { can_trade: true, reason: "" },
    balance: Number(data?.balance ?? 0),
    equity: Number(data?.equity ?? 0),
    free_margin: Number(data?.free_margin ?? 0),
    margin: Number(data?.margin ?? 0),
    margin_level: Number(data?.margin_level ?? 0),
    portfolio_risk_pct: Number(data?.portfolio_risk_pct ?? 0),
    max_portfolio_risk_pct: Number(data?.max_portfolio_risk_pct ?? 3.0) || 3.0,
    remaining_capacity_pct: Number(data?.remaining_capacity_pct ?? 3.0),
    open_positions: Array.isArray(data?.open_positions) ? data.open_positions : [],
    estimations: typeof data?.estimations === "object" && data?.estimations !== null ? data.estimations : {},
    timestamp: data?.timestamp || new Date().toISOString(),
  };

  const riskPct = safeData.portfolio_risk_pct;
  const maxRisk = safeData.max_portfolio_risk_pct;
  const progress = Math.min(1.0, Math.max(0, riskPct / maxRisk));
  const remaining = Math.max(0, maxRisk - riskPct);

  const isCbActive = safeData.can_trade !== false && !safeData.circuit_breaker.is_tripped;

  return (
    <View style={styles.card}>
      {/* Institutional Bento Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.shieldIconWrap}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.title}>RISK ENGINE V2</Text>
            <Text style={styles.subtitle}>Enforced Portfolio Allocation</Text>
          </View>
        </View>

        {/* Circuit Breaker Status Badge (Verde = Activo, Ámbar/Rojo = Pausa de Seguridad) */}
        <View
          style={[
            styles.cbBadge,
            isCbActive ? styles.cbBadgeActive : styles.cbBadgePaused,
          ]}
        >
          <View
            style={[
              styles.cbDot,
              { backgroundColor: isCbActive ? "#10B981" : "#EF4444" },
            ]}
          />
          <Text
            style={[
              styles.cbText,
              { color: isCbActive ? "#34D399" : "#F87171" },
            ]}
          >
            {isCbActive ? "CIRCUIT BREAKER: ACTIVO" : "CIRCUIT BREAKER: PAUSA"}
          </Text>
        </View>
      </View>

      {/* Portfolio Risk Exposure HD Progress Bar */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Exposición de Portafolio</Text>
          <Text style={styles.value}>
            <Text
              style={{
                color: riskPct > maxRisk * 0.8 ? "#EF4444" : "#10B981",
                fontWeight: "800",
                fontSize: 16,
              }}
            >
              {riskPct.toFixed(2)}%
            </Text>{" "}
            <Text style={{ fontSize: 11, color: "#64748B" }}>/ {maxRisk.toFixed(1)}% máx</Text>
          </Text>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: riskPct > maxRisk * 0.8 ? "#EF4444" : "#10B981",
              },
            ]}
          />
        </View>

        <View style={styles.scaleRow}>
          <Text style={styles.scaleText}>0.0%</Text>
          <Text style={styles.scaleText}>
            Capacidad restante: <Text style={{ color: "#38BDF8", fontWeight: "700" }}>{remaining.toFixed(2)}%</Text>
          </Text>
          <Text style={styles.scaleText}>3.0%</Text>
        </View>
      </View>

      {/* Capacity & Margin Telemetry */}
      <View style={[styles.section, styles.borderTop]}>
        <View style={styles.rowGrid}>
          <View style={styles.gridCol}>
            <Text style={styles.gridLabel}>Capacidad Restante</Text>
            <Text style={[styles.gridValue, { color: "#38BDF8" }]}>
              {remaining.toFixed(2)}%
            </Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.gridLabel}>Margen Libre</Text>
            <Text style={styles.gridValue}>
              {safeData.free_margin.toLocaleString("en", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}€
            </Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.gridLabel}>Nivel de Margen</Text>
            <Text
              style={[
                styles.gridValue,
                { color: safeData.margin_level >= 500 ? "#10B981" : "#F59E0B" },
              ]}
            >
              {safeData.margin_level > 0 ? `${safeData.margin_level.toFixed(0)}%` : "Inf"}
            </Text>
          </View>
        </View>
      </View>

      {/* Sizing Estimation per Symbol */}
      <View style={[styles.section, styles.borderTop]}>
        <Text style={styles.subTitle}>Dimensionamiento de Lote por Símbolo</Text>
        <View style={styles.rowGrid}>
          {["EURUSD", "XAUUSD", "BTCEUR"].map((sym) => {
            const est = safeData.estimations?.[sym];
            const isApproved = est?.approved ?? true;
            const lotStr = Number(est?.lot ?? (sym === "EURUSD" ? 0.01 : 0.02)).toFixed(2);
            return (
              <View key={sym} style={styles.symbolCard}>
                <Text style={styles.symbolName}>{sym}</Text>
                <Text
                  style={[
                    styles.symbolLot,
                    { color: isApproved ? "#34D399" : "#94A3B8" },
                  ]}
                >
                  {isApproved ? `${lotStr} lot` : "PAUSADO"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shieldIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  cbBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  cbBadgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  cbBadgePaused: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  cbDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cbText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  section: {
    gap: 8,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  value: {
    fontSize: 13,
    color: "#F8FAFC",
    fontVariant: ["tabular-nums"],
  },
  progressBarTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  scaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scaleText: {
    fontSize: 10,
    color: "#64748B",
    fontVariant: ["tabular-nums"],
  },
  rowGrid: {
    flexDirection: "row",
    gap: 10,
  },
  gridCol: {
    flex: 1,
    gap: 2,
  },
  gridLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  gridValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC",
    fontVariant: ["tabular-nums"],
  },
  subTitle: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 4,
  },
  symbolCard: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    gap: 2,
  },
  symbolName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  symbolLot: {
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
