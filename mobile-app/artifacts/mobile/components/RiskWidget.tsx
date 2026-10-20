import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
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

interface RiskDashboardData {
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
  error?: string;
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
    const interval = setInterval(fetchRiskData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchRiskData]);

  if (loading && !data) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: "center" }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const safeData = {
    balance: Number(data?.balance ?? 0),
    equity: Number(data?.equity ?? (data as any)?.account_equity ?? 0),
    free_margin: Number(data?.free_margin ?? (data as any)?.account_equity ?? 0),
    margin: Number(data?.margin ?? 0),
    margin_level: Number(data?.margin_level ?? (data as any)?.margin_level_pct ?? 0),
    portfolio_risk_pct: Number(data?.portfolio_risk_pct ?? 0),
    max_portfolio_risk_pct: Number(data?.max_portfolio_risk_pct ?? 3.0) || 3.0,
    remaining_capacity_pct: Number(data?.remaining_capacity_pct ?? 3.0),
    open_positions: Array.isArray(data?.open_positions) ? data.open_positions : [],
    estimations: (typeof data?.estimations === "object" && data?.estimations !== null) ? data.estimations : {},
    timestamp: data?.timestamp || new Date().toISOString()
  };

  const riskPct = typeof safeData.portfolio_risk_pct === "number" && !isNaN(safeData.portfolio_risk_pct) ? safeData.portfolio_risk_pct : 0;
  const maxRisk = typeof safeData.max_portfolio_risk_pct === "number" && safeData.max_portfolio_risk_pct > 0 ? safeData.max_portfolio_risk_pct : 3.0;
  const progress = maxRisk > 0 ? Math.min(1.0, Math.max(0, riskPct / maxRisk)) : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Institutional Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="shield" size={14} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>RISK ENGINE V2</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.statusBadgeText, { color: colors.mutedForeground }]}>ENFORCED</Text>
        </View>
      </View>

      {/* Barra de progreso de riesgo */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Portfolio Exposure</Text>
          <Text style={[styles.value, { color: riskPct > maxRisk * 0.8 ? colors.loss : colors.foreground }]}>
            {riskPct.toFixed(2)}% <Text style={{ fontSize: 11, color: colors.mutedForeground }}>/ {maxRisk.toFixed(1)}% max</Text>
          </Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
          <View style={[styles.progressBarFill, { 
            width: `${progress * 100}%`, 
            backgroundColor: riskPct > maxRisk * 0.8 ? colors.loss : colors.profit 
          }]} />
        </View>
      </View>

      {/* Posiciones abiertas y su riesgo */}
      <View style={[styles.section, styles.borderTop, { borderTopColor: colors.border }]}>
        <Text style={[styles.subTitle, { color: colors.mutedForeground }]}>Open Risk Allocation</Text>
        {safeData.open_positions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No open positions with active risk exposure</Text>
        ) : (
          safeData.open_positions.map((pos, idx) => (
            <View key={idx} style={styles.positionRow}>
              <View>
                <Text style={[styles.positionSym, { color: colors.foreground }]}>{pos?.symbol || "–"}</Text>
                <Text style={[styles.positionTicket, { color: colors.mutedForeground }]}>
                  Ticket #{pos?.ticket ?? 0} · Lot {Number(pos?.volume ?? 0).toFixed(2)}
                </Text>
              </View>
              <Text style={[styles.positionRisk, { color: colors.foreground }]}>
                {Number(pos?.risk_pct ?? 0).toFixed(2)}%{" "}
                <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                  ({Number(pos?.risk_amount ?? 0).toFixed(0)}€)
                </Text>
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Capacidad Restante */}
      <View style={[styles.section, styles.borderTop, { borderTopColor: colors.border }]}>
        <Text style={[styles.subTitle, { color: colors.mutedForeground }]}>Capacity Telemetry</Text>
        <View style={styles.rowGrid}>
          <View style={styles.gridCol}>
            <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Remaining Risk</Text>
            <Text style={[styles.gridValue, { color: colors.foreground }]}>
              {Math.max(0, maxRisk - riskPct).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Free Margin</Text>
            <Text style={[styles.gridValue, { color: colors.foreground }]}>
              {safeData.free_margin.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€
            </Text>
          </View>
        </View>
      </View>

      {/* Estimaciones próximas señales */}
      <View style={[styles.section, styles.borderTop, { borderTopColor: colors.border }]}>
        <Text style={[styles.subTitle, { color: colors.mutedForeground }]}>Next Signal Sizing Estimate</Text>
        <View style={styles.rowGrid}>
          {['EURUSD', 'XAUUSD', 'BTCEUR'].map((sym) => {
            const est = safeData.estimations?.[sym];
            const isApproved = est?.approved ?? true;
            const lotStr = Number(est?.lot ?? (sym === "EURUSD" ? 0.01 : 0.02)).toFixed(2);
            const rawReason = String(est?.reason || "Blocked");
            const displayReason = rawReason.includes("]") ? (rawReason.split("]")[1] || rawReason) : rawReason;
            return (
              <View key={sym} style={styles.gridCol}>
                <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>{sym}</Text>
                <Text style={[styles.gridValue, { color: isApproved ? colors.profit : colors.mutedForeground }]}>
                  {isApproved ? `${lotStr} lot` : "BLOCKED"}
                </Text>
                {!isApproved && (
                  <Text style={[styles.blockedReason, { color: colors.loss }]}>{displayReason}</Text>
                )}
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
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  subTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  section: {
    gap: 8,
  },
  borderTop: {
    borderTopWidth: 1,
    paddingTop: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  gridCol: {
    flex: 1,
    gap: 2,
  },
  gridLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  gridValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  value: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  emptyText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  positionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  positionSym: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  positionTicket: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  positionRisk: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  blockedReason: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  }
});
