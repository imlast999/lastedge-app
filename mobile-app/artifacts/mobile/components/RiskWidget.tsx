import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
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

  const safeData = data ?? {
    balance: 5000,
    equity: 5000,
    free_margin: 5000,
    margin: 0,
    margin_level: 0,
    portfolio_risk_pct: 0.0,
    max_portfolio_risk_pct: 2.0,
    remaining_capacity_pct: 2.0,
    open_positions: [],
    estimations: {},
    timestamp: new Date().toISOString()
  };

  const riskPct = safeData.portfolio_risk_pct;
  const maxRisk = safeData.max_portfolio_risk_pct;
  const progress = Math.min(1.0, riskPct / maxRisk);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>🛡️ Portfolio Risk Engine</Text>

      {/* Barra de progreso de riesgo */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Exposición Actual</Text>
          <Text style={[styles.value, { color: riskPct > maxRisk * 0.8 ? colors.loss : colors.foreground, fontFamily: "Inter_700Bold" }]}>
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
        <Text style={[styles.subTitle, { color: colors.foreground }]}>Riesgo por Posición</Text>
        {safeData.open_positions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sin posiciones abiertas en riesgo</Text>
        ) : (
          safeData.open_positions.map((pos, idx) => (
            <View key={idx} style={styles.positionRow}>
              <View>
                <Text style={[styles.positionSym, { color: colors.foreground }]}>{pos.symbol}</Text>
                <Text style={[styles.positionTicket, { color: colors.mutedForeground }]}>Ticket #{pos.ticket} · Lot {pos.volume.toFixed(2)}</Text>
              </View>
              <Text style={[styles.positionRisk, { color: colors.foreground }]}>
                {pos.risk_pct.toFixed(2)}% <Text style={{ fontSize: 10, color: colors.mutedForeground }}>({pos.risk_amount.toFixed(0)}€)</Text>
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Capacidad Restante */}
      <View style={[styles.section, styles.borderTop, { borderTopColor: colors.border }]}>
        <Text style={[styles.subTitle, { color: colors.foreground }]}>Capacidad Restante</Text>
        <View style={styles.rowGrid}>
          <View style={styles.gridCol}>
            <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Riesgo Disponible</Text>
            <Text style={[styles.gridValue, { color: colors.foreground }]}>
              {Math.max(0, maxRisk - riskPct).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Margen Libre</Text>
            <Text style={[styles.gridValue, { color: colors.foreground }]}>
              {safeData.free_margin.toFixed(0)}€
            </Text>
          </View>
        </View>
      </View>

      {/* Estimaciones próximas señales */}
      <View style={[styles.section, styles.borderTop, { borderTopColor: colors.border }]}>
        <Text style={[styles.subTitle, { color: colors.foreground }]}>Lote Estimado (Próxima Señal)</Text>
        <View style={styles.rowGrid}>
          {['EURUSD', 'XAUUSD', 'BTCEUR'].map((sym) => {
            const est = safeData.estimations?.[sym];
            return (
              <View key={sym} style={styles.gridCol}>
                <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>{sym}</Text>
                <Text style={[styles.gridValue, { color: est?.approved ? colors.profit : colors.mutedForeground }]}>
                  {est?.approved ? `${est.lot.toFixed(2)}` : "BLOCKED"}
                </Text>
                {est && !est.approved && (
                  <Text style={[styles.blockedReason, { color: colors.loss }]}>{est.reason.split("]")[1] || est.reason}</Text>
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginVertical: 6,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  section: {
    gap: 8,
  },
  borderTop: {
    borderTopWidth: 1,
    paddingTop: 12,
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
    fontFamily: "Inter_400Regular",
  },
  gridValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  value: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "Inter_400Regular",
  },
  positionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
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
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  blockedReason: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  }
});
