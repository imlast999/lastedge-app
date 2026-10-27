import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type {
  QuantitativePillars,
  PillarsAnalysisResponse,
} from "@/services/researchApi";
import { promoteCandidateStrategy } from "@/services/researchApi";

interface Props {
  data?: PillarsAnalysisResponse | null;
  onPromoted?: () => void;
}

export function PedagogicalPillarsSuite({ data, onPromoted }: Props) {
  const [expandedTooltip, setExpandedTooltip] = useState<string | null>("p1");
  const [promoting, setPromoting] = useState(false);
  const [promotedSuccess, setPromotedSuccess] = useState(false);

  if (!data?.pillars) {
    return null;
  }

  const pillars = data.pillars;
  const p1 = pillars?.pillar_1_monte_carlo;
  const p2 = pillars?.pillar_2_walk_forward;
  const p3 = pillars?.pillar_3_overfitting_sharpe;
  const p4 = pillars?.pillar_4_payoff_execution;
  const p5 = pillars?.pillar_5_regimes;
  const p6 = pillars?.pillar_6_verdict;

  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) {
    return null;
  }

  const toggleTooltip = (pillarKey: string) => {
    setExpandedTooltip((prev) => (prev === pillarKey ? null : pillarKey));
  };

  const handlePromote = async () => {
    if (promoting || promotedSuccess) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setPromoting(true);

    try {
      const res = await promoteCandidateStrategy(p6.candidate_id, "Architect");
      if (res.ok) {
        setPromotedSuccess(true);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert(
          "🏆 Estrategia Promocionada a Producción",
          `La estrategia ${data.strategy} (${data.symbol}) ha sido registrada como candidata activa en el Trading Engine MT5 con lotaje institucional.`,
          [{ text: "Entendido", onPress: () => onPromoted?.() }]
        );
      } else {
        Alert.alert("Error de Promoción", res.message || "No se pudo registrar la estrategia.");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setPromoting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── PILAR 1: MONTE CARLO (1,000 ITERACIONES) ── */}
      <View style={styles.pillarCard}>
        <View style={styles.pillarHeader}>
          <View style={styles.pillarIconPill}>
            <Feather name="activity" size={15} color="#38BDF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pillarTag}>PILAR 1</Text>
            <Text style={styles.pillarTitle}>Robustez & Simulación Monte Carlo</Text>
          </View>
          <Badge badge={p1.badge} />
        </View>

        {/* Dato + Comparativa Institucional */}
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Probabilidad de Ruina</Text>
            <Text style={[styles.metricBigValue, { color: p1.ruin_probability_pct < 1 ? "#10B981" : "#F59E0B" }]}>
              {(p1.ruin_probability_pct ?? 0).toFixed(1)}%
            </Text>
            <Text style={styles.metricBenchmark}>{p1.threshold}</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>P95 / P99 Max Drawdown</Text>
            <Text style={styles.metricValue}>
              {(p1.drawdown_95_pct ?? 0).toFixed(1)}% / {(p1.drawdown_99_pct ?? 0).toFixed(1)}%
            </Text>
            <Text style={styles.metricBenchmark}>1,000 permutaciones</Text>
          </View>
        </View>

        <View style={styles.metricRowSub}>
          <Text style={styles.subLabel}>Beneficio Mediano vs Peor Caso:</Text>
          <Text style={styles.subValue}>
            +{(p1.median_profit_pips ?? 0).toFixed(1)} pips vs +{(p1.worst_case_profit_pips ?? 0).toFixed(1)} pips
          </Text>
        </View>

        {/* Tooltip Desplegable Pedagógico */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleTooltip("p1")}
          activeOpacity={0.7}
        >
          <Feather name="help-circle" size={13} color="#38BDF8" />
          <Text style={styles.accordionTitle}>¿Qué significa este dato?</Text>
          <Feather
            name={expandedTooltip === "p1" ? "chevron-up" : "chevron-down"}
            size={14}
            color="#64748B"
          />
        </TouchableOpacity>

        {expandedTooltip === "p1" && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{p1.explanation}</Text>
            <Text style={styles.whyMattersText}>
              <Text style={{ fontWeight: "700", color: "#38BDF8" }}>Impacto en capital: </Text>
              {p1.why_it_matters}
            </Text>
          </View>
        )}
      </View>

      {/* ── PILAR 2: WALK FORWARD ANALYSIS (WFA) ── */}
      <View style={styles.pillarCard}>
        <View style={styles.pillarHeader}>
          <View style={[styles.pillarIconPill, { backgroundColor: "rgba(168, 85, 247, 0.12)" }]}>
            <Feather name="repeat" size={15} color="#A855F7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pillarTag, { color: "#C084FC" }]}>PILAR 2</Text>
            <Text style={styles.pillarTitle}>Walk-Forward Analysis & Generalización</Text>
          </View>
          <Badge badge={p2.badge} />
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Eficiencia Walk-Forward (WFE)</Text>
            <Text style={[styles.metricBigValue, { color: p2.wfe_ratio >= 60 ? "#10B981" : "#EF4444" }]}>
              {(p2.wfe_ratio ?? 0).toFixed(1)}%
            </Text>
            <Text style={styles.metricBenchmark}>{p2.threshold}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Estabilidad Parámetros</Text>
            <Text style={[styles.metricValue, { color: p2.is_robust ? "#10B981" : "#F59E0B" }]}>
              {p2.is_robust ? "ROBUSTA" : "DEGRADACIÓN"}
            </Text>
            <Text style={styles.metricBenchmark}>4 Ventanas Móviles</Text>
          </View>
        </View>

        {/* Ventanas Móviles Traffic Light */}
        <View style={styles.windowsRow}>
          {(p2.windows || []).map((w, idx) => (
            <View key={idx} style={styles.windowChip}>
              <View
                style={[
                  styles.windowDot,
                  { backgroundColor: w.badge === "PASSED" ? "#10B981" : "#F59E0B" },
                ]}
              />
              <Text style={styles.windowName}>{w.window}</Text>
              <Text style={styles.windowPf}>PF {(w.test_pf ?? 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleTooltip("p2")}
          activeOpacity={0.7}
        >
          <Feather name="help-circle" size={13} color="#A855F7" />
          <Text style={[styles.accordionTitle, { color: "#C084FC" }]}>¿Qué significa este dato?</Text>
          <Feather
            name={expandedTooltip === "p2" ? "chevron-up" : "chevron-down"}
            size={14}
            color="#64748B"
          />
        </TouchableOpacity>

        {expandedTooltip === "p2" && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{p2.explanation}</Text>
            <Text style={styles.whyMattersText}>
              <Text style={{ fontWeight: "700", color: "#C084FC" }}>Impacto en capital: </Text>
              {p2.why_it_matters}
            </Text>
          </View>
        )}
      </View>

      {/* ── PILAR 3: SOBREAJUSTE & DEFLATED SHARPE ── */}
      <View style={styles.pillarCard}>
        <View style={styles.pillarHeader}>
          <View style={[styles.pillarIconPill, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
            <Feather name="shield" size={15} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pillarTag, { color: "#FBBF24" }]}>PILAR 3</Text>
            <Text style={styles.pillarTitle}>Test de Sobreajuste & Deflated Sharpe</Text>
          </View>
          <Badge badge={p3.badge} />
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Sharpe Deflactado (DSR)</Text>
            <Text style={[styles.metricBigValue, { color: p3.deflated_sharpe_ratio >= 1.0 ? "#10B981" : "#F59E0B" }]}>
              {(p3.deflated_sharpe_ratio ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.metricBenchmark}>{p3.threshold}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Sharpe Base vs Sortino</Text>
            <Text style={styles.metricValue}>
              {(p3.traditional_sharpe ?? 0).toFixed(2)} / {(p3.sortino_ratio ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.metricBenchmark}>Penaliza sólo caídas</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleTooltip("p3")}
          activeOpacity={0.7}
        >
          <Feather name="help-circle" size={13} color="#F59E0B" />
          <Text style={[styles.accordionTitle, { color: "#FBBF24" }]}>¿Qué significa este dato?</Text>
          <Feather
            name={expandedTooltip === "p3" ? "chevron-up" : "chevron-down"}
            size={14}
            color="#64748B"
          />
        </TouchableOpacity>

        {expandedTooltip === "p3" && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{p3.explanation}</Text>
            <Text style={styles.whyMattersText}>
              <Text style={{ fontWeight: "700", color: "#FBBF24" }}>Impacto en capital: </Text>
              {p3.why_it_matters}
            </Text>
          </View>
        )}
      </View>

      {/* ── PILAR 4: PAYOFF MATEMÁTICO & CALIDAD DE EJECUCIÓN ── */}
      <View style={styles.pillarCard}>
        <View style={styles.pillarHeader}>
          <View style={[styles.pillarIconPill, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
            <Feather name="trending-up" size={15} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pillarTag, { color: "#34D399" }]}>PILAR 4</Text>
            <Text style={styles.pillarTitle}>Payoff Matemático & Calidad de Ejecución</Text>
          </View>
          <Badge badge={p4.badge} />
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Profit Factor (PF)</Text>
            <Text style={[styles.metricBigValue, { color: p4.profit_factor >= 1.3 ? "#10B981" : "#EF4444" }]}>
              {(p4.profit_factor ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.metricBenchmark}>{p4.threshold}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Esperanza / Trade</Text>
            <Text style={[styles.metricValue, { color: "#34D399" }]}>
              +{p4.expectancy_pips.toFixed(1)} pips (${p4.expectancy_usd.toFixed(2)})
            </Text>
            <Text style={styles.metricBenchmark}>R:R Promedio: 1:{(p4.risk_reward_ratio ?? 0).toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.metricRowSub}>
          <Text style={styles.subLabel}>Racha Máx Pérdidas Consecutivas:</Text>
          <Text style={[styles.subValue, { color: p4.max_consecutive_losses < p4.circuit_breaker_limit ? "#10B981" : "#EF4444" }]}>
            {p4.max_consecutive_losses} pérdidas (Límite Circuit Breaker: {p4.circuit_breaker_limit})
          </Text>
        </View>

        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleTooltip("p4")}
          activeOpacity={0.7}
        >
          <Feather name="help-circle" size={13} color="#10B981" />
          <Text style={[styles.accordionTitle, { color: "#34D399" }]}>¿Qué significa este dato?</Text>
          <Feather
            name={expandedTooltip === "p4" ? "chevron-up" : "chevron-down"}
            size={14}
            color="#64748B"
          />
        </TouchableOpacity>

        {expandedTooltip === "p4" && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{p4.explanation}</Text>
            <Text style={styles.whyMattersText}>
              <Text style={{ fontWeight: "700", color: "#10B981" }}>Impacto en capital: </Text>
              {p4.why_it_matters}
            </Text>
          </View>
        )}
      </View>

      {/* ── PILAR 5: STRESS TEST POR REGÍMENES DE MERCADO ── */}
      <View style={styles.pillarCard}>
        <View style={styles.pillarHeader}>
          <View style={[styles.pillarIconPill, { backgroundColor: "rgba(59, 130, 246, 0.12)" }]}>
            <Feather name="globe" size={15} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pillarTag, { color: "#60A5FA" }]}>PILAR 5</Text>
            <Text style={styles.pillarTitle}>Stress Test por Regímenes de Mercado</Text>
          </View>
          <Badge badge={p5.badge} />
        </View>

        {/* 4 Macro Regimes Breakdown */}
        <View style={styles.regimesGrid}>
          {(p5.regimes || []).map((reg) => (
            <View key={reg.id} style={styles.regimeItem}>
              <View style={styles.regimeHeader}>
                <Text style={styles.regimeName} numberOfLines={1}>{reg.name}</Text>
                <View
                  style={[
                    styles.regimePill,
                    {
                      backgroundColor:
                        reg.badge === "PASSED" ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: reg.badge === "PASSED" ? "#34D399" : "#FBBF24",
                    }}
                  >
                    PF {(reg.profit_factor ?? 0).toFixed(2)}
                  </Text>
                </View>
              </View>
              <Text style={styles.regimeMeta}>
                {reg.trades} trades · {(reg.win_rate ?? 0).toFixed(0)}% WR · +${reg.pnl_usd.toFixed(0)}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleTooltip("p5")}
          activeOpacity={0.7}
        >
          <Feather name="help-circle" size={13} color="#3B82F6" />
          <Text style={[styles.accordionTitle, { color: "#60A5FA" }]}>¿Qué significa este dato?</Text>
          <Feather
            name={expandedTooltip === "p5" ? "chevron-up" : "chevron-down"}
            size={14}
            color="#64748B"
          />
        </TouchableOpacity>

        {expandedTooltip === "p5" && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>{p5.explanation}</Text>
            <Text style={styles.whyMattersText}>
              <Text style={{ fontWeight: "700", color: "#3B82F6" }}>Impacto en capital: </Text>
              {p5.why_it_matters}
            </Text>
          </View>
        )}
      </View>

      {/* ── PILAR 6: VEREDICTO INSTITUCIONAL Y PROMOCIÓN ── */}
      <View style={[styles.pillarCard, styles.verdictCard]}>
        <View style={styles.verdictTop}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNumber}>{p6.score}</Text>
            <Text style={styles.scoreLabel}>SCORE</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.verdictBadgeRow}>
              <View
                style={[
                  styles.verdictBadge,
                  p6.status === "INSTITUTIONAL GRADE"
                    ? styles.verdictBadgeGreen
                    : p6.status === "CONDITIONAL PASSED"
                    ? styles.verdictBadgeAmber
                    : styles.verdictBadgeRed,
                ]}
              >
                <Text
                  style={[
                    styles.verdictBadgeText,
                    p6.status === "INSTITUTIONAL GRADE"
                      ? { color: "#34D399" }
                      : p6.status === "CONDITIONAL PASSED"
                      ? { color: "#FBBF24" }
                      : { color: "#F87171" },
                  ]}
                >
                  {p6.status}
                </Text>
              </View>
            </View>
            <Text style={styles.verdictTitle}>{p6.verdict_title}</Text>
          </View>
        </View>

        <Text style={styles.verdictDescription}>{p6.verdict_description}</Text>

        {/* Botón Promocionar a Producción */}
        <TouchableOpacity
          style={[
            styles.promoteBtn,
            promotedSuccess && styles.promoteBtnSuccess,
            (!p6.can_promote || promoting) && { opacity: 0.6 },
          ]}
          onPress={handlePromote}
          disabled={!p6.can_promote || promoting || promotedSuccess}
          activeOpacity={0.8}
        >
          {promoting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : promotedSuccess ? (
            <>
              <MaterialCommunityIcons name="shield-check" size={18} color="#FFFFFF" />
              <Text style={styles.promoteBtnText}>PROMOCIONADA A MT5</Text>
            </>
          ) : (
            <>
              <Feather name="arrow-up-right" size={18} color="#FFFFFF" />
              <Text style={styles.promoteBtnText}>PROMOCIONAR A PRODUCCIÓN EN MT5</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Badge({ badge }: { badge: "PASSED" | "WARNING" | "DANGER" }) {
  const isPassed = badge === "PASSED";
  const isWarn = badge === "WARNING";
  const bg = isPassed
    ? "rgba(16, 185, 129, 0.15)"
    : isWarn
    ? "rgba(245, 158, 11, 0.15)"
    : "rgba(239, 68, 68, 0.15)";
  const color = isPassed ? "#34D399" : isWarn ? "#FBBF24" : "#F87171";
  const text = isPassed ? "🟢 Aprobado" : isWarn ? "🟡 Precaución" : "🔴 Peligro";

  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    marginTop: 6,
  },
  pillarCard: {
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  pillarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pillarIconPill: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  pillarTag: {
    fontSize: 9,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.5,
  },
  pillarTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricItem: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metricBigValue: {
    fontSize: 22,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC",
    fontVariant: ["tabular-nums"],
  },
  metricBenchmark: {
    fontSize: 10,
    color: "#64748B",
    fontVariant: ["tabular-nums"],
  },
  metricRowSub: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  subLabel: {
    fontSize: 10,
    color: "#64748B",
  },
  subValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F8FAFC",
    fontVariant: ["tabular-nums"],
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  accordionTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#38BDF8",
  },
  explanationBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 6,
  },
  explanationText: {
    fontSize: 11,
    color: "#CBD5E1",
    lineHeight: 16,
  },
  whyMattersText: {
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
  },
  windowsRow: {
    flexDirection: "row",
    gap: 6,
  },
  windowChip: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    padding: 6,
    alignItems: "center",
    gap: 2,
  },
  windowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  windowName: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "600",
  },
  windowPf: {
    fontSize: 10,
    color: "#F8FAFC",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  regimesGrid: {
    gap: 6,
  },
  regimeItem: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    padding: 8,
    gap: 2,
  },
  regimeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  regimeName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0",
    flex: 1,
  },
  regimePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  regimeMeta: {
    fontSize: 10,
    color: "#64748B",
    fontVariant: ["tabular-nums"],
  },
  verdictCard: {
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  verdictTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 2,
    borderColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#10B981",
    fontVariant: ["tabular-nums"],
    lineHeight: 22,
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.5,
  },
  verdictBadgeRow: {
    flexDirection: "row",
  },
  verdictBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  verdictBadgeGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  verdictBadgeAmber: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  verdictBadgeRed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  verdictBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  verdictTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  verdictDescription: {
    fontSize: 12,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  promoteBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 4,
  },
  promoteBtnSuccess: {
    backgroundColor: "#059669",
  },
  promoteBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
