/**
 * Lab Screen — LastEdge Research Database & Laboratory
 * 
 * Flujo consolidado y optimizado para el usuario:
 * 1. Crear nueva investigación (Símbolo, Estrategia, Hipótesis)
 * 2. Visualizar ficha completa (Métricas, Git commit, Configuración JSON)
 * 3. Filtrar por búsqueda de texto, símbolo y dictamen (con opción de Reset)
 * 4. Editar dictamen científico (DRAFT, CANDIDATE, PROMOTED, REJECTED, ARCHIVED) y notas
 * 5. Reabrir y volver a ejecutar cargando los parámetros reproducibles exactos
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/context/SettingsContext";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { useTranslation } from "@/hooks/useTranslation";
import {
  listResearchExperiments,
  fetchResearchExperimentDetail,
  updateResearchExperiment,
  fetchReopenPayload,
  runExitResearch,
  type ResearchExperiment,
} from "@/services/researchApi";

export default function LabScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { settings, apiOverrides } = useSettings();

  // Datos
  const [experiments, setExperiments] = useState<ResearchExperiment[]>([]);
  const [selectedExp, setSelectedExp] = useState<ResearchExperiment | null>(null);

  // Filtros
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
  const [formStrategy, setFormStrategy] = useState("xauusd_partial");
  const [formTitle, setFormTitle] = useState("");
  const [formHypothesis, setFormHypothesis] = useState("");
  const [isReopenMode, setIsReopenMode] = useState(false);

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

  // Resetear Filtros
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSymbol("ALL");
    setSelectedStatus("ALL");
  };

  // Abrir Modal de Crear Nueva Investigación
  const handleOpenNewModal = () => {
    setIsReopenMode(false);
    setFormSymbol("EURUSD");
    setFormStrategy("eurusd_partial");
    setFormTitle("Nueva Validación Cuantitativa");
    setFormHypothesis("Validar estabilidad out-of-sample y trailing stop optimizado.");
    setNewModalVisible(true);
  };

  // Abrir Modal de Reabrir Experimento Existente
  const handleOpenReopenModal = async () => {
    if (!selectedExp) return;
    setActionLoading(true);
    try {
      const payload = await fetchReopenPayload(selectedExp.experiment_id, apiOverrides);
      setIsReopenMode(true);
      setFormSymbol(payload.symbol || selectedExp.symbol);
      setFormStrategy(payload.strategy || selectedExp.strategy);
      setFormTitle(`Reapertura: ${selectedExp.title}`);
      setFormHypothesis(`Réplica de investigación ${selectedExp.experiment_id} (Commit: ${payload.git_commit ?? 'actual'}).`);
      setDetailModalVisible(false);
      setNewModalVisible(true);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  // Ejecutar / Encolar Investigación (Crear o Reabrir)
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
          isReopenMode ? "🚀 Investigación Reabierta" : "⚡ Nueva Investigación Iniciada",
          `Tarea de simulación #${res.taskId ?? 'OK'} encolada correctamente para ${formSymbol} (${formStrategy}).`
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

  // Guardar Dictamen Científico (PATCH)
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
      
      // Actualizar vista local
      const updated = { ...selectedExp, decision_status: editStatus, decision_notes: editNotes };
      setSelectedExp(updated);
      await loadExperiments();
      Alert.alert("Dictamen Guardado", `Investigación ${selectedExp.experiment_id} actualizada a ${editStatus}.`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const getBadgeColors = (status: string) => {
    switch (status) {
      case "PROMOTED":
        return { bg: "#065f46", text: "#34d399" };
      case "CANDIDATE":
        return { bg: "#78350f", text: "#fbbf24" };
      case "REJECTED":
        return { bg: "#881337", text: "#f43f5e" };
      case "ARCHIVED":
        return { bg: "#374151", text: "#9ca3af" };
      default:
        return { bg: "#1f2937", text: "#d1d5db" };
    }
  };

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

      {/* Header con botón de Crear e Ajustes */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: colors.foreground }]}>Research Database</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Trazabilidad, reproducibilidad y dictamen de experimentos
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleOpenNewModal}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Nueva</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/settings-modal" as any)}
            style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="settings" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Buscador de Investigaciones */}
      <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Buscar por hipótesis, notas, etiquetas o ID..."
          placeholderTextColor={colors.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtros de Símbolo */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>Filtros:</Text>
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
              <Text style={{ color: selectedSymbol === sym ? colors.primaryForeground : colors.foreground, fontSize: 12, fontWeight: "500" }}>
                {sym}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filtros de Dictamen */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
        {["ALL", "PROMOTED", "CANDIDATE", "REJECTED", "DRAFT", "ARCHIVED"].map((st) => (
          <TouchableOpacity
            key={st}
            onPress={() => setSelectedStatus(st)}
            style={[
              styles.chip,
              {
                backgroundColor: selectedStatus === st ? colors.primary : colors.secondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={{ color: selectedStatus === st ? colors.primaryForeground : colors.foreground, fontSize: 12, fontWeight: "500" }}>
              {st}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Listado de Investigaciones */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            Experimentos Registrados ({experiments.length})
          </Text>
          <TouchableOpacity onPress={loadExperiments}>
            <Feather name="refresh-cw" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loadingList ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
        ) : experiments.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center" }]}>
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
            const badge = getBadgeColors(exp.decision_status);
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
                  <Text style={[styles.expItemTitle, { color: colors.foreground }]}>{exp.title}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>{exp.decision_status}</Text>
                  </View>
                </View>

                {exp.hypothesis ? (
                  <Text style={[styles.expHypothesis, { color: colors.mutedForeground }]} numberOfLines={2}>
                    💡 {exp.hypothesis}
                  </Text>
                ) : null}

                <View style={styles.expItemMeta}>
                  <Text style={[styles.expMetaText, { color: colors.mutedForeground }]}>
                    {exp.symbol} · PF: {exp.best_profit_factor?.toFixed(2) ?? "—"} · Est: {exp.best_stability_score?.toFixed(1) ?? "—"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {exp.git_commit ? (
                      <Text style={[styles.gitBadge, { color: colors.mutedForeground }]}>
                        git:{exp.git_commit.slice(0, 7)}
                      </Text>
                    ) : null}
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* ── MODAL 1: FICHA DE DETALLE DE INVESTIGACIÓN ── */}
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
                    <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>ID: {selectedExp.experiment_id}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                    <Feather name="x" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.detailBlock}>
                    <StatRow label="Símbolo / Estrategia" value={`${selectedExp.symbol} (${selectedExp.strategy})`} colors={colors} />
                    <StatRow label="Versión del Bot" value={selectedExp.bot_version || "1.1.0"} colors={colors} />
                    <StatRow label="Commit de Git" value={selectedExp.git_commit || "n/a"} colors={colors} />
                    <StatRow label="Fecha de Registro" value={new Date(selectedExp.created_at).toLocaleString()} colors={colors} />
                  </View>

                  {selectedExp.hypothesis ? (
                    <View style={[styles.detailBlock, { marginTop: 10 }]}>
                      <Text style={[styles.blockLabel, { color: colors.mutedForeground }]}>💡 Hipótesis de Investigación</Text>
                      <Text style={[styles.blockBody, { color: colors.foreground }]}>{selectedExp.hypothesis}</Text>
                    </View>
                  ) : null}

                  {/* Métricas clave */}
                  <View style={styles.metricsGrid}>
                    <MetricCard label="Profit Factor" value={selectedExp.best_profit_factor?.toFixed(2) ?? "—"} colors={colors} />
                    <MetricCard label="Win Rate" value={`${selectedExp.best_winrate?.toFixed(1) ?? "—"}%`} colors={colors} />
                    <MetricCard label="Stability Score" value={selectedExp.best_stability_score?.toFixed(1) ?? "—"} colors={colors} />
                    <MetricCard label="Max Drawdown" value={`${selectedExp.best_max_drawdown?.toFixed(0) ?? "—"} pips`} colors={colors} />
                  </View>

                  {/* Dictamen Científico */}
                  <View style={[styles.detailBlock, { marginTop: 10 }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.blockLabel, { color: colors.mutedForeground }]}>Dictamen Científico</Text>
                      <View style={[styles.badge, { backgroundColor: getBadgeColors(selectedExp.decision_status).bg }]}>
                        <Text style={[styles.badgeText, { color: getBadgeColors(selectedExp.decision_status).text }]}>
                          {selectedExp.decision_status}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.blockBody, { color: colors.foreground, marginTop: 6 }]}>
                      {selectedExp.decision_notes || selectedExp.notes || "Sin notas registradas."}
                    </Text>
                  </View>

                  {/* Configuración reproducible JSON en desplegable */}
                  <TouchableOpacity
                    onPress={() => setShowConfigJson(!showConfigJson)}
                    style={[styles.toggleJsonBtn, { backgroundColor: colors.secondary }]}
                  >
                    <Feather name={showConfigJson ? "chevron-up" : "code"} size={14} color={colors.primary} />
                    <Text style={[styles.toggleJsonText, { color: colors.primary }]}>
                      {showConfigJson ? "Ocultar Configuración JSON" : "Ver Configuración Reproducible (JSON)"}
                    </Text>
                  </TouchableOpacity>

                  {showConfigJson && selectedExp.config_json ? (
                    <View style={[styles.jsonBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.jsonText, { color: colors.mutedForeground }]}>
                        {JSON.stringify(selectedExp.config_json, null, 2)}
                      </Text>
                    </View>
                  ) : null}
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

      {/* ── MODAL 2: EDITAR DICTAMEN ── */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Editar Dictamen Científico</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>ID: {selectedExp?.experiment_id}</Text>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Nuevo Estado:</Text>
            <View style={styles.statusOptions}>
              {(["DRAFT", "CANDIDATE", "PROMOTED", "REJECTED", "ARCHIVED"] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => setEditStatus(st)}
                  style={[
                    styles.statusOption,
                    {
                      backgroundColor: editStatus === st ? colors.primary : colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: editStatus === st ? colors.primaryForeground : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 12 }]}>Notas y Razón de la Decisión:</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
              multiline
              numberOfLines={4}
              placeholder="Escribe la justificación científica..."
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
              {isReopenMode ? "🔄 Reabrir Investigación" : "⚡ Nueva Investigación"}
            </Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              {isReopenMode ? "Cargarás la configuración exacta y relanzarás la prueba." : "Configura los parámetros para iniciar una simulación cuantitativa."}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Símbolo:</Text>
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

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Título:</Text>
            <TextInput
              style={[styles.singleInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Título descriptivo..."
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Hipótesis:</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, height: 70 }]}
              multiline
              value={formHypothesis}
              onChangeText={setFormHypothesis}
              placeholder="Objetivo de la prueba..."
              placeholderTextColor={colors.mutedForeground}
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
                    {isReopenMode ? "Lanzar Réplica" : "Iniciar Prueba"}
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
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  headerContent: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 42, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  filterSection: { gap: 4 },
  filterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  filterLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  resetText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  chipsContainer: { gap: 6, paddingRight: 16 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  expItem: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  expItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  expItemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  expHypothesis: { fontSize: 12, fontFamily: "Inter_400Regular" },
  expItemMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  expMetaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  gitBadge: { fontSize: 10, fontFamily: "Inter_600SemiBold", backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailBlock: { gap: 4 },
  blockLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  blockBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 },
  metricCard: { flex: 1, minWidth: "45%", borderWidth: 1, borderRadius: 8, padding: 8, alignItems: "center" },
  metricLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  metricValue: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2 },
  toggleJsonBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 8, marginTop: 8 },
  toggleJsonText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  jsonBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 6, maxHeight: 150 },
  jsonText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 16 },
  modalCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 10, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  inputLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  statusOption: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  singleInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 12, marginTop: 4 },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 10, textAlignVertical: "top", fontSize: 12, marginTop: 4 },
  modalActionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  flexBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
