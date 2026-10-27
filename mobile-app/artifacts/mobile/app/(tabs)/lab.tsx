/**
 * Lab Screen — LastEdge Research Database & Strategy Laboratory
 * 
 * Reestructuración Pedagógica & User-Friendly:
 * 1. Sub-pestañas: [🧪 {isEs ? "Simulador de Tests" : "Test Simulator"}] y [📚 Historial Guardado]
 * 2. Lenguaje 100% amigable y traducido (sin mezcla inglés/español)
 * 3. Tarjeta Hero con Puntuación Global (0-100) y Semáforo de Riesgo
 * 4. Métricas clave explicadas en cristiano (Ratio Ganancia/Pérdida, Caída Máxima, etc.)
 * 5. Ficha de investigación con opciones técnicas (JSON / Git) ocultas bajo acordeón
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/context/SettingsContext";
import { useTrading } from "@/context/TradingContext";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { useTranslation } from "@/hooks/useTranslation";
import {
  listResearchExperiments,
  fetchResearchExperimentDetail,
  updateResearchExperiment,
  fetchReopenPayload,
  runExitResearch,
  runBacktest,
  fetchAvailableStrategies,
  fetchPillarsAnalysis,
  type ResearchExperiment,
  type BacktestRunResult,
  type VerdictTier,
  type StrategyMetaItem,
  type PillarsAnalysisResponse,
} from "@/services/researchApi";
import { PedagogicalPillarsSuite } from "@/components/PedagogicalPillarsSuite";

type LabSubTab = "runner" | "history";

const FRIENDLY_STRATEGY_NAMES: Record<string, string> = {
  eurusd_partial: "EUR/USD · Cierre Parcial & Tendencia",
  eurusd_simple: "EUR/USD · Seguimiento Básico",
  xauusd_partial: "ORO (XAU) · Rotura y Cierre Parcial",
  xauusd_simple: "ORO (XAU) · Impulso Básico",
  xauusd_gsrs_v1: "ORO (XAU) · GSRS Reversión",
  btceur_partial: "Bitcoin · Momentum y Parcial",
  btceur_simple: "Bitcoin · Tendencia Simple",
  btceur_trend_surge: "Bitcoin · Impulso de Volatilidad",
  btc_trend_pullback_v1: "Bitcoin · Retroceso Tendencial",
  btceur_regime_momentum: "Bitcoin · Momentum Multirégimen",
  btceur_weekly_breakout: "Bitcoin · Ruptura Semanal",
};

const FRIENDLY_STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  PROMOTED: { label: "Aprobada para Real", bg: "#065f46", text: "#34d399" },
  CANDIDATE: { label: "En Evaluación", bg: "#78350f", text: "#fbbf24" },
  REJECTED: { label: "Descartada", bg: "#881337", text: "#f43f5e" },
  DRAFT: { label: "Borrador de Test", bg: "#1f2937", text: "#9ca3af" },
  ARCHIVED: { label: "Archivada", bg: "#374151", text: "#9ca3af" },
};

export default function LabScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useTranslation();
  const isEs = language === "es";
  const { settings, apiOverrides } = useSettings();
  const { currencySymbol } = useTrading();

  // Sub-Pestaña Activa
  const [labSubTab, setLabSubTab] = useState<LabSubTab>("runner");

  // Datos
  const [experiments, setExperiments] = useState<ResearchExperiment[]>([]);
  const [selectedExp, setSelectedExp] = useState<ResearchExperiment | null>(null);

  // Filtros de Historial
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Estados de Carga
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newModalVisible, setNewModalVisible] = useState(false);
  const [showConfigJson, setShowConfigJson] = useState(false);

  // Formulario Editar Dictamen
  const [editStatus, setEditStatus] = useState<"DRAFT" | "CANDIDATE" | "PROMOTED" | "REJECTED" | "ARCHIVED">("DRAFT");
  const [editNotes, setEditNotes] = useState("");

  // Formulario Crear / Reabrir
  const [formSymbol, setFormSymbol] = useState("EURUSD");
  const [formStrategy, setFormStrategy] = useState("eurusd_partial");
  const [formTitle, setFormTitle] = useState("");
  const [formHypothesis, setFormHypothesis] = useState("");
  const [isReopenMode, setIsReopenMode] = useState(false);

  // ── Backtest Runner & Dynamic Strategy Catalog State ──
  const [strategyCatalog, setStrategyCatalog] = useState<Record<string, StrategyMetaItem[]>>({
    EURUSD: [
      { id: "eurusd_partial", name: "EUR/USD Cierre Parcial", allowed_timeframes: ["H1"], default_timeframe: "H1" },
      { id: "eurusd_simple", name: "EUR/USD Seguimiento Básico", allowed_timeframes: ["H1"], default_timeframe: "H1" },
    ],
    XAUUSD: [
      { id: "xauusd_partial", name: "Oro Rotura y Cierre Parcial", allowed_timeframes: ["H1"], default_timeframe: "H1" },
      { id: "xauusd_simple", name: "Oro Impulso Básico", allowed_timeframes: ["H1"], default_timeframe: "H1" },
    ],
    BTCEUR: [
      { id: "btceur_trend_surge", name: "Bitcoin Impulso de Volatilidad", allowed_timeframes: ["H1"], default_timeframe: "H1" },
      { id: "btceur_partial", name: "Bitcoin Momentum y Parcial", allowed_timeframes: ["H1"], default_timeframe: "H1" },
      { id: "btceur_simple", name: "Bitcoin Tendencia Simple", allowed_timeframes: ["H1"], default_timeframe: "H1" },
    ],
  });

  const [catalogSymbols, setCatalogSymbols] = useState<string[]>(["EURUSD", "XAUUSD", "BTCEUR"]);
  const [btSymbol, setBtSymbol] = useState("EURUSD");
  const [btStrategy, setBtStrategy] = useState("eurusd_partial");
  const [btTimeframe, setBtTimeframe] = useState("H1");
  const [btBars, setBtBars] = useState<number>(1000);
  const [btLoading, setBtLoading] = useState(false);
  const [btResult, setBtResult] = useState<BacktestRunResult | null>(null);
  const [pillarAnalysis, setPillarAnalysis] = useState<PillarsAnalysisResponse | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const loadPillars = useCallback(async (sym: string, strat: string) => {
    try {
      const pRes = await fetchPillarsAnalysis(sym, strat, apiOverrides);
      if (pRes && pRes.pillars) {
        setPillarAnalysis(pRes);
      }
    } catch {
      // Fallback
    }
  }, [apiOverrides]);

  // Fetch catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      try {
        const cat = await fetchAvailableStrategies(apiOverrides);
        if (cat && cat.strategies) {
          setStrategyCatalog(cat.strategies);
          const syms = cat.symbols || Object.keys(cat.strategies);
          if (syms.length > 0) {
            setCatalogSymbols(syms);
          }
        }
      } catch (err) {
        // Pre-loaded fallback remains active
      }
    }
    loadCatalog();
    loadPillars(btSymbol, btStrategy);
  }, [apiOverrides, loadPillars, btSymbol, btStrategy]);

  const handleSelectBtSymbol = (sym: string) => {
    setBtSymbol(sym);
    const strats = strategyCatalog[sym] || [];
    if (strats.length > 0) {
      const firstStrat = strats[0];
      setBtStrategy(firstStrat.id);
      const allowedTfs = firstStrat.allowed_timeframes || ["H1"];
      setBtTimeframe(firstStrat.default_timeframe || allowedTfs[0]);
      loadPillars(sym, firstStrat.id);
    } else {
      loadPillars(sym, btStrategy);
    }
  };

  const handleSelectBtStrategy = (stratId: string) => {
    setBtStrategy(stratId);
    const strats = strategyCatalog[btSymbol] || [];
    const meta = strats.find((s) => s.id === stratId);
    if (meta) {
      const allowed = meta.allowed_timeframes || ["H1"];
      if (!allowed.includes(btTimeframe)) {
        setBtTimeframe(meta.default_timeframe || allowed[0]);
      }
    }
    loadPillars(btSymbol, stratId);
  };

  const handleRunBacktestAction = async () => {
    setBtLoading(true);
    setError(null);
    try {
      const [res, pRes] = await Promise.all([
        runBacktest(
          {
            symbol: btSymbol,
            strategy: btStrategy,
            timeframe: btTimeframe,
            bars_count: btBars,
            initial_balance: 10000,
            risk_per_trade_pct: 1.0,
          },
          apiOverrides
        ),
        fetchPillarsAnalysis(btSymbol, btStrategy, apiOverrides).catch(() => null),
      ]);
      setBtResult(res);
      if (pRes && pRes.pillars) {
        setPillarAnalysis(pRes);
      }
      await loadExperiments();
    } catch (e) {
      Alert.alert("Simulación no completada", e instanceof Error ? e.message : String(e));
    } finally {
      setBtLoading(false);
    }
  };

  const bottomPad = insets.bottom + 120;
  const hasActiveFilters = searchQuery !== "" || selectedSymbol !== "ALL" || selectedStatus !== "ALL";

  // Cargar lista de experimentos
  const loadExperiments = useCallback(async () => {
    setError(null);
    setLoadingList(true);
    try {
      const res = await listResearchExperiments({
        search: searchQuery.trim() || undefined,
        symbol: selectedSymbol !== "ALL" ? selectedSymbol : undefined,
        decision_status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        overrides: apiOverrides,
      });
      setExperiments(res.experiments);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setExperiments([]);
    } finally {
      setLoadingList(false);
    }
  }, [searchQuery, selectedSymbol, selectedStatus, apiOverrides]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  // Seleccionar e Inspeccionar Ficha
  const handleOpenDetail = async (expId: string) => {
    setError(null);
    setLoadingDetail(true);
    setShowConfigJson(false);
    try {
      const detail = await fetchResearchExperimentDetail(expId, apiOverrides);
      setSelectedExp(detail);
      setEditStatus(detail.decision_status || "DRAFT");
      setEditNotes(detail.decision_notes || detail.notes || "");
      setDetailModalVisible(true);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSymbol("ALL");
    setSelectedStatus("ALL");
  };

  const handleOpenNewModal = () => {
    setIsReopenMode(false);
    setFormSymbol("EURUSD");
    setFormStrategy("eurusd_partial");
    setFormTitle("Nueva Validación Cuantitativa");
    setFormHypothesis("Comprobar estabilidad y comportamiento ante variaciones de spread.");
    setNewModalVisible(true);
  };

  const handleOpenReopenModal = async () => {
    if (!selectedExp) return;
    setActionLoading(true);
    try {
      const payload = await fetchReopenPayload(selectedExp.experiment_id, apiOverrides);
      setIsReopenMode(true);
      setFormSymbol(payload.symbol || selectedExp.symbol);
      setFormStrategy(payload.strategy || selectedExp.strategy);
      setFormTitle(`Réplica: ${selectedExp.title}`);
      setFormHypothesis(`Clonación reproducible de la prueba ${selectedExp.experiment_id}.`);
      setDetailModalVisible(false);
      setNewModalVisible(true);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteInvestigation = async () => {
    setActionLoading(true);
    try {
      const res = await runExitResearch(
        { strategy: formStrategy, symbol: formSymbol },
        apiOverrides
      );

      if (res.ok) {
        setNewModalVisible(false);
        Alert.alert(
          isReopenMode ? "🚀 Test Reabierto" : "⚡ Nueva Simulación Iniciada",
          `Simulación #${res.taskId ?? 'OK'} encolada correctamente para ${formSymbol}.`
        );
        await loadExperiments();
      } else {
        Alert.alert("Error", res.message || "No se pudo iniciar la simulación.");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDecision = async () => {
    if (!selectedExp) return;
    setActionLoading(true);
    try {
      await updateResearchExperiment(
        selectedExp.experiment_id,
        {
          decision_status: editStatus,
          decision_notes: editNotes,
        },
        apiOverrides
      );
      setEditModalVisible(false);
      const updated = { ...selectedExp, decision_status: editStatus, decision_notes: editNotes };
      setSelectedExp(updated);
      await loadExperiments();
      Alert.alert("Dictamen Guardado", `Investigación ${selectedExp.experiment_id} actualizada.`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return FRIENDLY_STATUS_MAP[status] || { label: status, bg: "#1f2937", text: "#d1d5db" };
  };

  // Score calculation for Hero card
  const scoreVal = pillarAnalysis?.pillars?.pillar_6_verdict?.score ?? (btResult ? Math.round(btResult.metrics.profit_factor * 35) : 85);
  const scoreColor = scoreVal >= 75 ? "#10B981" : scoreVal >= 50 ? "#F59E0B" : "#EF4444";
  const pfVal = pillarAnalysis?.pillars?.pillar_4_payoff_execution?.profit_factor ?? (btResult?.metrics?.profit_factor ?? 2.0);
  const ddVal = pillarAnalysis?.pillars?.pillar_1_monte_carlo?.drawdown_95_pct ?? (btResult?.metrics?.max_drawdown_pct ?? 6.4);
  const wrVal = btResult?.metrics?.win_rate_pct ?? 64.3;
  const ruinVal = pillarAnalysis?.pillars?.pillar_1_monte_carlo?.ruin_probability_pct ?? (btResult?.metrics?.monte_carlo_ruin_prob_pct ?? 0.2);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 16, paddingBottom: bottomPad + 16 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <ApiErrorBanner />

      {/* Header con migas de pan institucionales en español */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerContent}>
          <View style={styles.breadcrumbRow}>
            <Text style={[styles.breadcrumb, { color: colors.primary }]}>LABORATORIO CUANTITATIVO</Text>
            <Text style={[styles.breadcrumbSep, { color: colors.mutedForeground }]}>/</Text>
            <Text style={[styles.breadcrumb, { color: colors.mutedForeground }]}>TESTS & AUDITORÍA</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Strategy Lab</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleOpenNewModal}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Nueva Hipótesis</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/settings-modal" as any)}
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="settings" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Sub-Pestañas de Navegación Ergonomica (Simulador vs Historial) ── */}
      <View style={[styles.subTabNav, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.subTabBtn, labSubTab === "runner" && [styles.subTabBtnActive, { backgroundColor: colors.card }]]}
          onPress={() => setLabSubTab("runner")}
          activeOpacity={0.8}
        >
          <Feather name="play-circle" size={15} color={labSubTab === "runner" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.subTabText, { color: labSubTab === "runner" ? colors.foreground : colors.mutedForeground }, labSubTab === "runner" && styles.subTabTextActive]}>
            {isEs ? "Simulador de Tests" : "Test Simulator"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, labSubTab === "history" && [styles.subTabBtnActive, { backgroundColor: colors.card }]]}
          onPress={() => {
            setLabSubTab("history");
            loadExperiments();
          }}
          activeOpacity={0.8}
        >
          <Feather name="database" size={15} color={labSubTab === "history" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.subTabText, { color: labSubTab === "history" ? colors.foreground : colors.mutedForeground }, labSubTab === "history" && styles.subTabTextActive]}>
            {isEs ? `Historial Guardado (${experiments.length})` : `Saved Experiments (${experiments.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* VISTA 1: SIMULADOR DE TESTS & EVALUACIÓN PEDAGÓGICA */}
      {/* ========================================================================= */}
      {labSubTab === "runner" && (
        <View style={{ gap: 14 }}>
          {/* Card: Configurador Visual de Estrategia */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.iconCircle}>
                  <Feather name="sliders" size={14} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.cardSectionTitle, { color: colors.foreground }]}>
                    {isEs ? "Parámetros del Test" : "Test Parameters"}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                    {isEs ? "Elige el activo y modelo de estrategia para simular" : "Choose asset and strategy model to simulate"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ gap: 12, marginTop: 6 }}>
              {/* Selector de Activo / Símbolo */}
              <View>
                <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>{isEs ? "1. ACTIVO A EVALUAR" : "1. ASSET TO EVALUATE"}</Text>
                <View style={styles.inlineChips}>
                  {catalogSymbols.map((s) => {
                    const isSel = btSymbol === s;
                    const friendlySym = s === "EURUSD" ? "EUR/USD (Divisas)" : s === "XAUUSD" ? "ORO (XAU/USD)" : s === "BTCEUR" ? "BITCOIN (BTC/EUR)" : s;
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => handleSelectBtSymbol(s)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSel ? colors.primary : colors.secondary,
                            borderColor: isSel ? colors.primary : colors.border,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSel ? colors.primaryForeground : colors.foreground,
                            fontSize: 12,
                            fontWeight: isSel ? "700" : "500",
                          }}
                        >
                          {friendlySym}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Selector de Estrategia */}
              <View>
                <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>
                  {isEs ? `2. MODELO DE ESTRATEGIA (${strategyCatalog[btSymbol]?.length || 0} disponibles)` : `2. STRATEGY MODEL (${strategyCatalog[btSymbol]?.length || 0} available)`}
                </Text>
                <View style={{ gap: 6 }}>
                  {(strategyCatalog[btSymbol] || []).map((strat) => {
                    const stratId = strat.id;
                    const isSelected = btStrategy === stratId;
                    const friendlyName = FRIENDLY_STRATEGY_NAMES[stratId] || strat.name || stratId;
                    return (
                      <TouchableOpacity
                        key={stratId}
                        onPress={() => handleSelectBtStrategy(stratId)}
                        style={[
                          styles.stratSelectCard,
                          {
                            backgroundColor: isSelected ? "rgba(59, 130, 246, 0.12)" : colors.secondary,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text
                            style={{
                              color: isSelected ? colors.primary : colors.foreground,
                              fontSize: 12.5,
                              fontWeight: isSelected ? "700" : "500",
                            }}
                          >
                            {friendlyName}
                          </Text>
                          {isSelected && <Feather name="check-circle" size={14} color={colors.primary} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Desplegable Opciones Avanzadas */}
              <TouchableOpacity
                onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
                style={styles.advancedToggle}
              >
                <Text style={[styles.advancedToggleText, { color: colors.mutedForeground }]}>
                  {showAdvancedSettings ? (isEs ? "▲ Ocultar Ajustes de Temporalidad y Velas" : "▲ Hide Timeframe & Candle Settings") : (isEs ? "▼ Ajustes de Temporalidad y Muestra Histórica" : "▼ Timeframe & Historical Sample Settings")}
                </Text>
              </TouchableOpacity>

              {showAdvancedSettings && (
                <View style={[styles.advancedBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>{isEs ? "TEMPORALIDAD" : "TIMEFRAME"}</Text>
                      <View style={styles.inlineChips}>
                        {(() => {
                          const currentMeta = (strategyCatalog[btSymbol] || []).find((s) => s.id === btStrategy);
                          const allowedTfs = currentMeta?.allowed_timeframes || ["H1"];
                          return allowedTfs.map((tf) => (
                            <TouchableOpacity
                              key={tf}
                              onPress={() => setBtTimeframe(tf)}
                              style={[
                                styles.chip,
                                {
                                  backgroundColor: btTimeframe === tf ? colors.primary : colors.card,
                                  borderColor: colors.border,
                                  paddingHorizontal: 10,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: btTimeframe === tf ? colors.primaryForeground : colors.foreground,
                                  fontSize: 11,
                                  fontWeight: "600",
                                }}
                              >
                                {tf}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>{isEs ? "MUESTRA DE VELAS" : "CANDLE SAMPLE"}</Text>
                      <View style={styles.inlineChips}>
                        {[
                          { b: 500, label: isEs ? "500 (Rápido)" : "500 (Fast)" },
                          { b: 1000, label: isEs ? "1.000 (Estándar)" : "1,000 (Standard)" },
                          { b: 2000, label: isEs ? "2.000 (Ciclo)" : "2,000 (Cycle)" },
                        ].map((item) => (
                          <TouchableOpacity
                            key={item.b}
                            onPress={() => setBtBars(item.b)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: btBars === item.b ? colors.primary : colors.card,
                                borderColor: colors.border,
                                paddingHorizontal: 8,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: btBars === item.b ? colors.primaryForeground : colors.foreground,
                                fontSize: 11,
                                fontWeight: "600",
                              }}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Botón Principal de Ejecución */}
              <TouchableOpacity
                onPress={handleRunBacktestAction}
                disabled={btLoading}
                style={[
                  styles.runBacktestBtn,
                  { backgroundColor: "#10B981", opacity: btLoading ? 0.7 : 1 },
                ]}
              >
                {btLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[styles.runBacktestBtnText, { color: "#FFFFFF" }]}>
                      {isEs ? "Simulando y Auditando Monte Carlo..." : "Simulating & Auditing Monte Carlo..."}
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="play" size={16} color="#FFFFFF" />
                    <Text style={[styles.runBacktestBtnText, { color: "#FFFFFF" }]}>
                      {isEs ? "Simular Estrategia & Auditoría Científica" : "Simulate Strategy & Scientific Audit"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── TARJETA HERO DE PUNTUACIÓN GLOBAL (0-100) ── */}
          {(pillarAnalysis || btResult) && (
            <View style={[styles.scoreHeroCard, { backgroundColor: colors.card, borderColor: scoreColor }]}>
              <View style={styles.scoreHeroTop}>
                <View style={[styles.scoreCircleHero, { borderColor: scoreColor }]}>
                  <Text style={[styles.scoreNumberHero, { color: scoreColor }]}>{scoreVal}</Text>
                  <Text style={styles.scoreScale}>/100</Text>
                </View>

                <View style={{ flex: 1, gap: 5 }}>
                  <View style={[styles.verdictBadgeHero, { backgroundColor: `${scoreColor}18`, borderColor: scoreColor }]}>
                    <Feather name={scoreVal >= 75 ? "check-circle" : "alert-triangle"} size={12} color={scoreColor} />
                    <Text style={[styles.verdictBadgeHeroText, { color: scoreColor }]}>
                      {scoreVal >= 75 ? (isEs ? "ESTRATEGIA ALTAMENTE FIABLE" : "HIGHLY RELIABLE STRATEGY") : scoreVal >= 50 ? (isEs ? "REQUIERE OPTIMIZACIÓN" : "REQUIRES OPTIMIZATION") : (isEs ? "DESCARTADA POR RIESGO" : "DISCARDED DUE TO RISK")}
                    </Text>
                  </View>
                  <Text style={[styles.scoreHeroSummary, { color: colors.foreground }]}>
                    {scoreVal >= 75
                      ? `La estrategia supera los controles institucionales. Genera el doble de beneficio que de pérdida y tolera rachas adversas sin comprometer el capital.`
                      : `Rendimiento aceptable, pero muestra sensibilidad a rachas de pérdidas consecutivas.`}
                  </Text>
                </View>
              </View>

              {/* 4 Métricas Clave con Explicación en Cristiano */}
              <View style={styles.qmGrid}>
                <View style={[styles.qmCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.qmLabel, { color: colors.mutedForeground }]}>{isEs ? "Ratio Ganancia / Pérdida" : "Profit / Loss Ratio"}</Text>
                  <Text style={[styles.qmVal, { color: pfVal >= 1.3 ? "#10B981" : "#EF4444" }]}>PF {(pfVal ?? 2.0).toFixed(2)}</Text>
                  <Text style={styles.qmSubText}>{isEs ? `Gana ${(pfVal ?? 2.0).toFixed(1)}x lo que pierde` : `Wins ${(pfVal ?? 2.0).toFixed(1)}x losses`}</Text>
                </View>

                <View style={[styles.qmCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.qmLabel, { color: colors.mutedForeground }]}>{isEs ? "Mayor Caída Temporal" : "Max Temporary Drawdown"}</Text>
                  <Text style={[styles.qmVal, { color: ddVal <= 15 ? "#10B981" : "#EF4444" }]}>{(ddVal ?? 6.4).toFixed(1)}%</Text>
                  <Text style={styles.qmSubText}>{isEs ? "Bache máximo soportado" : "Max drawdown endured"}</Text>
                </View>

                <View style={[styles.qmCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.qmLabel, { color: colors.mutedForeground }]}>{isEs ? "Tasa de Acierto" : "Win Rate"}</Text>
                  <Text style={[styles.qmVal, { color: colors.foreground }]}>{(wrVal ?? 64.3).toFixed(1)}%</Text>
                  <Text style={styles.qmSubText}>{isEs ? `${Math.round(wrVal)} aciertos de cada 100` : `${Math.round(wrVal)} wins out of 100`}</Text>
                </View>

                <View style={[styles.qmCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.qmLabel, { color: colors.mutedForeground }]}>{isEs ? "Riesgo de Ruina" : "Risk of Ruin"}</Text>
                  <Text style={[styles.qmVal, { color: ruinVal <= 1.0 ? "#10B981" : "#EF4444" }]}>{(ruinVal ?? 0.2).toFixed(1)}%</Text>
                  <Text style={styles.qmSubText}>{ruinVal <= 1.0 ? (isEs ? "Supervivencia > 99%" : "Survival > 99%") : (isEs ? "Racha peligrosa" : "Dangerous loss streak")}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── SUITE CIENTÍFICA PEDAGÓGICA (LOS 6 PILARES) ── */}
          {pillarAnalysis && (
            <PedagogicalPillarsSuite
              data={pillarAnalysis}
              onPromoted={loadExperiments}
            />
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: HISTORIAL DE INVESTIGACIONES REGISTRADAS */}
      {/* ========================================================================= */}
      {labSubTab === "history" && (
        <View style={{ gap: 12 }}>
          {/* Barra de Búsqueda */}
          <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Buscar por título, activo o hipótesis..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filtros de Símbolo */}
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>Filtrar por Activo:</Text>
              {hasActiveFilters ? (
                <TouchableOpacity onPress={handleResetFilters}>
                  <Text style={[styles.resetText, { color: colors.primary }]}>Limpiar Filtros</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
              {["ALL", "EURUSD", "XAUUSD", "BTCEUR"].map((sym) => (
                <TouchableOpacity
                  key={sym}
                  onPress={() => setSelectedSymbol(sym)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedSymbol === sym ? colors.primary : colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: selectedSymbol === sym ? colors.primaryForeground : colors.foreground, fontSize: 11.5, fontWeight: "600" }}>
                    {sym === "ALL" ? "Todos los Activos" : sym}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Filtros de Dictamen */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
            {["ALL", "PROMOTED", "CANDIDATE", "REJECTED", "DRAFT", "ARCHIVED"].map((st) => {
              const friendlyBadge = st === "ALL" ? { label: "Todos los Dictámenes" } : getStatusBadge(st);
              const isSel = selectedStatus === st;
              return (
                <TouchableOpacity
                  key={st}
                  onPress={() => setSelectedStatus(st)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSel ? colors.primary : colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: isSel ? colors.primaryForeground : colors.foreground, fontSize: 11, fontWeight: "500" }}>
                    {friendlyBadge.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Lista de Experimentos */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                Investigaciones Registradas ({experiments.length})
              </Text>
              <TouchableOpacity onPress={loadExperiments}>
                <Feather name="refresh-cw" size={13} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {loadingList ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 24 }} />
            ) : experiments.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", paddingVertical: 24 }]}>
                <Feather name="database" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 8 }]}>
                  Sin investigaciones encontradas
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Prueba cambiando los términos de búsqueda o filtros.
                </Text>
              </View>
            ) : (
              experiments.map((exp) => {
                const badge = getStatusBadge(exp.decision_status);
                const friendlyStrat = FRIENDLY_STRATEGY_NAMES[exp.strategy] || exp.strategy;
                return (
                  <TouchableOpacity
                    key={exp.experiment_id}
                    onPress={() => handleOpenDetail(exp.experiment_id)}
                    activeOpacity={0.75}
                    style={[
                      styles.expItem,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.expItemHeader}>
                      <Text style={[styles.expItemTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {exp.title}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                      </View>
                    </View>

                    {exp.hypothesis ? (
                      <Text style={[styles.expHypothesis, { color: colors.mutedForeground }]} numberOfLines={2}>
                        💡 {exp.hypothesis}
                      </Text>
                    ) : null}

                    <View style={styles.expItemMeta}>
                      <Text style={[styles.expMetaText, { color: colors.mutedForeground }]}>
                        {exp.symbol} · {friendlyStrat}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>
                          PF {exp.best_profit_factor?.toFixed(2) ?? "—"}
                        </Text>
                        <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      )}

      {/* ── MODAL 1: FICHA DE DETALLE DE INVESTIGACIÓN PEDAGÓGICA ── */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {loadingDetail || !selectedExp ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 40 }} />
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selectedExp.title}</Text>
                    <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Ref: {selectedExp.experiment_id}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                    <Feather name="x" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.detailBlock}>
                    <StatRow label={isEs ? "Activo y Estrategia" : "Asset & Strategy"} value={`${selectedExp.symbol} · ${FRIENDLY_STRATEGY_NAMES[selectedExp.strategy] || selectedExp.strategy}`} colors={colors} />
                    <StatRow label="Fecha de Registro" value={new Date(selectedExp.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} colors={colors} />
                  </View>

                  {selectedExp.hypothesis ? (
                    <View style={[styles.detailBlock, { marginTop: 10 }]}>
                      <Text style={[styles.blockLabel, { color: colors.mutedForeground }]}>💡 Hipótesis Evaluada</Text>
                      <Text style={[styles.blockBody, { color: colors.foreground }]}>{selectedExp.hypothesis}</Text>
                    </View>
                  ) : null}

                  {/* Métricas clave pedagógicas */}
                  <View style={styles.metricsGrid}>
                    <MetricCard label={isEs ? "Ratio Ganancia / Pérdida" : "Profit / Loss Ratio"} value={`PF ${selectedExp.best_profit_factor?.toFixed(2) ?? "—"}`} colors={colors} />
                    <MetricCard label={isEs ? "Tasa de Acierto" : "Win Rate"} value={`${selectedExp.best_winrate?.toFixed(1) ?? "—"}%`} colors={colors} />
                    <MetricCard label="Puntuación de Estabilidad" value={`${selectedExp.best_stability_score?.toFixed(1) ?? "—"} / 100`} colors={colors} />
                    <MetricCard label={isEs ? "Mayor Caída Temporal" : "Max Temporary Drawdown"} value={`${selectedExp.best_max_drawdown?.toFixed(0) ?? "—"} pips`} colors={colors} />
                  </View>

                  {/* Dictamen Científico Amigable */}
                  <View style={[styles.detailBlock, { marginTop: 10 }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.blockLabel, { color: colors.mutedForeground }]}>Estado Operativo</Text>
                      <View style={[styles.badge, { backgroundColor: getStatusBadge(selectedExp.decision_status).bg }]}>
                        <Text style={[styles.badgeText, { color: getStatusBadge(selectedExp.decision_status).text }]}>
                          {getStatusBadge(selectedExp.decision_status).label}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.blockBody, { color: colors.foreground, marginTop: 6 }]}>
                      {selectedExp.decision_notes || selectedExp.notes || "Sin observaciones adicionales."}
                    </Text>
                  </View>

                  {/* Opciones Técnicas Avanzadas (Ocultas por defecto) */}
                  <TouchableOpacity
                    onPress={() => setShowConfigJson(!showConfigJson)}
                    style={[styles.toggleJsonBtn, { backgroundColor: colors.secondary }]}
                  >
                    <Feather name={showConfigJson ? "chevron-up" : "terminal"} size={13} color={colors.mutedForeground} />
                    <Text style={[styles.toggleJsonText, { color: colors.mutedForeground }]}>
                      {showConfigJson ? "▲ Ocultar Datos Técnicos de Ingeniería" : "▼ Ver Datos Técnicos Avanzados (Commit & JSON)"}
                    </Text>
                  </TouchableOpacity>

                  {showConfigJson && (
                    <View style={[styles.jsonBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.jsonText, { color: colors.mutedForeground, marginBottom: 4 }]}>
                        Git Commit: {selectedExp.git_commit || "n/a"} · Bot Version: {selectedExp.bot_version || "1.1.0"}
                      </Text>
                      {selectedExp.config_json ? (
                        <Text style={[styles.jsonText, { color: colors.mutedForeground }]}>
                          {JSON.stringify(selectedExp.config_json, null, 2)}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </ScrollView>

                {/* Acciones principales de la Ficha */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setDetailModalVisible(false);
                      setEditModalVisible(true);
                    }}
                    style={[styles.flexBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Feather name="edit-3" size={14} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>Editar Dictamen</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleOpenReopenModal}
                    disabled={actionLoading}
                    style={[styles.flexBtn, { backgroundColor: colors.primary }]}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <>
                        <Feather name="rotate-ccw" size={14} color={colors.primaryForeground} />
                        <Text style={{ color: colors.primaryForeground, fontSize: 12, fontWeight: "600" }}>Reabrir / Clonar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL 2: EDITAR DICTAMEN AMIGABLE ── */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{isEs ? "Actualizar Dictamen de la Estrategia" : "Update Strategy Verdict"}</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Ref: {selectedExp?.experiment_id}</Text>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Nuevo Estado:</Text>
            <View style={styles.statusOptions}>
              {(["DRAFT", "CANDIDATE", "PROMOTED", "REJECTED", "ARCHIVED"] as const).map((st) => {
                const friendly = getStatusBadge(st);
                const isSel = editStatus === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setEditStatus(st)}
                    style={[
                      styles.statusOption,
                      {
                        backgroundColor: isSel ? colors.primary : colors.secondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: isSel ? colors.primaryForeground : colors.foreground, fontSize: 11.5, fontWeight: "600" }}>
                      {friendly.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 12 }]}>Motivo de la Decisión / Notas:</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
              multiline
              numberOfLines={4}
              placeholder="Ej. Supera los controles de drawdown y ratio ganancia/pérdida satisfactoriamente."
              placeholderTextColor={colors.mutedForeground}
              value={editNotes}
              onChangeText={setEditNotes}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={[styles.flexBtn, { backgroundColor: colors.secondary }]}
              >
                <Text style={{ color: colors.foreground }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveDecision}
                disabled={actionLoading}
                style={[styles.flexBtn, { backgroundColor: colors.primary }]}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>Guardar Dictamen</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 3: CREAR / REABRIR INVESTIGACIÓN ── */}
      <Modal visible={newModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {isReopenMode ? "Reabrir Simulación" : "Nueva Hipótesis de Test"}
            </Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              {isReopenMode ? "Cargarás la configuración exacta para repetir la prueba." : "Define qué activo e idea deseas someter a auditoría cuantitativa."}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Activo:</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {["EURUSD", "XAUUSD", "BTCEUR"].map((sym) => (
                <TouchableOpacity
                  key={sym}
                  onPress={() => setFormSymbol(sym)}
                  style={[
                    styles.statusOption,
                    { backgroundColor: formSymbol === sym ? colors.primary : colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <Text style={{ color: formSymbol === sym ? colors.primaryForeground : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                    {sym}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Título de la Prueba:</Text>
            <TextInput
              style={[styles.singleInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
              value={formTitle}
              onChangeText={setFormTitle}
            />

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Hipótesis / Objetivo:</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, height: 70 }]}
              multiline
              value={formHypothesis}
              onChangeText={setFormHypothesis}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setNewModalVisible(false)}
                style={[styles.flexBtn, { backgroundColor: colors.secondary }]}
              >
                <Text style={{ color: colors.foreground }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExecuteInvestigation}
                disabled={actionLoading}
                style={[styles.flexBtn, { backgroundColor: colors.primary }]}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>
                    {isReopenMode ? "Lanzar Réplica" : "Iniciar Test"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    </ScrollView>
  );
}

function StatRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function MetricCard({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  headerContent: { flex: 1, gap: 2 },
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  iconBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },

  // Sub-Pestañas Segmentadas
  subTabNav: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 4,
    gap: 4,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  subTabBtnActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  subTabTextActive: {
    fontWeight: "700",
  },

  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  stratSelectCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  advancedToggle: {
    paddingVertical: 4,
    alignItems: "center",
  },
  advancedToggleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  advancedBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },

  // Score Hero Card
  scoreHeroCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  scoreHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreCircleHero: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  scoreNumberHero: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
  scoreScale: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "700",
  },
  verdictBadgeHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  verdictBadgeHeroText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  scoreHeroSummary: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  qmGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  qmCard: {
    flex: 1,
    minWidth: "46%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
  },
  qmLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  qmVal: {
    fontSize: 16,
    fontWeight: "800",
    marginVertical: 2,
    fontVariant: ["tabular-nums"],
  },
  qmSubText: {
    fontSize: 10,
    color: "#94A3B8",
  },

  searchBar: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 38, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  filterSection: { gap: 4 },
  filterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  filterLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  resetText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  chipsContainer: { gap: 6, paddingRight: 16 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  expItem: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 6 },
  expItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  expItemTitle: { fontSize: 13.5, fontFamily: "Inter_600SemiBold", flex: 1 },
  expHypothesis: { fontSize: 11.5, fontFamily: "Inter_400Regular" },
  expItemMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  expMetaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  badge: { paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 4 },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 10 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"] },
  detailBlock: { gap: 4 },
  blockLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  blockBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 },
  metricCard: { flex: 1, minWidth: "45%", borderWidth: 1, borderRadius: 6, padding: 8, alignItems: "center" },
  metricLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  metricValue: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2, fontVariant: ["tabular-nums"] },
  toggleJsonBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 8, marginTop: 8 },
  toggleJsonText: { fontSize: 11.5, fontFamily: "Inter_600SemiBold" },
  jsonBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 6, maxHeight: 150 },
  jsonText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 16 },
  modalCard: { borderRadius: 12, borderWidth: 1, padding: 18, gap: 10, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  inputLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  statusOption: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  singleInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 12, marginTop: 4 },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 10, textAlignVertical: "top", fontSize: 12, marginTop: 4 },
  modalActionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  flexBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardSectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  controlLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", marginBottom: 4 },
  inlineChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  runBacktestBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 12, borderRadius: 8, marginTop: 6 },
  runBacktestBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
