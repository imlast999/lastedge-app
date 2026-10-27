import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/context/SettingsContext";
import { resolveApiConfig } from "@/lib/apiConfig";

export interface TradeFlowTarget {
  type: "position" | "signal" | "symbol";
  ticket?: number;
  id?: string;
  symbol: string;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface FlowData {
  ticket?: number;
  id?: string;
  symbol: string;
  type?: "BUY" | "SELL";
  entry?: number;
  sl?: number;
  tp?: number;
  profit?: number;
  volume?: number;
  current_price?: number;
  status?: string;
  candles: Candle[];
}

interface Props {
  visible: boolean;
  target: TradeFlowTarget | null;
  onClose: () => void;
}

export function TradeFlowModal({ visible, target, onClose }: Props) {
  const colors = useColors();
  const { settings, apiOverrides } = useSettings();
  const isEs = settings.language === "es";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowData, setFlowData] = useState<FlowData | null>(null);

  const fetchFlow = useCallback(async () => {
    if (!target) return;
    const { url: baseUrl, token } = resolveApiConfig(apiOverrides);
    let endpoint = "";
    if (target.type === "position" && target.ticket) {
      endpoint = `${baseUrl}/api/positions/${target.ticket}/flow`;
    } else if (target.type === "signal" && target.id) {
      endpoint = `${baseUrl}/api/signals/${target.id}/flow`;
    } else {
      endpoint = `${baseUrl}/api/candles/${target.symbol}`;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(endpoint, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.flow || json;
      setFlowData(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [target, apiOverrides]);

  useEffect(() => {
    if (visible && target) {
      setLoading(true);
      fetchFlow();
      const interval = setInterval(fetchFlow, 3000);
      return () => clearInterval(interval);
    } else {
      setFlowData(null);
    }
  }, [visible, target, fetchFlow]);

  // Candle chart rendering calculations
  const chartWidth = Dimensions.get("window").width - 48;
  const chartHeight = 250;
  const padRight = 55; // space for Y price labels
  const padBottom = 20;
  const plotWidth = chartWidth - padRight;
  const plotHeight = chartHeight - padBottom;

  const candles = useMemo(() => {
    if (!flowData?.candles || flowData.candles.length === 0) return [];
    // Show last 35 candles on mobile for clear visibility
    return flowData.candles.slice(-35);
  }, [flowData?.candles]);

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 1, priceRange: 1 };
    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));

    // Incorporate Entry, SL, TP into bounds
    if (flowData?.entry && flowData.entry > 0) {
      min = Math.min(min, flowData.entry);
      max = Math.max(max, flowData.entry);
    }
    if (flowData?.sl && flowData.sl > 0) {
      min = Math.min(min, flowData.sl);
      max = Math.max(max, flowData.sl);
    }
    if (flowData?.tp && flowData.tp > 0) {
      min = Math.min(min, flowData.tp);
      max = Math.max(max, flowData.tp);
    }

    // Add 5% padding top and bottom
    const span = max - min || 0.001;
    const pad = span * 0.06;
    return {
      minPrice: min - pad,
      maxPrice: max + pad,
      priceRange: (max + pad) - (min - pad),
    };
  }, [candles, flowData]);

  const getY = (price: number) => {
    if (priceRange === 0) return plotHeight / 2;
    return plotHeight - ((price - minPrice) / priceRange) * plotHeight;
  };

  const candleSlotWidth = plotWidth / Math.max(1, candles.length);
  const candleBodyWidth = Math.max(3, candleSlotWidth * 0.65);

  const profitSign = (flowData?.profit ?? 0) >= 0 ? "+" : "";
  const isProfit = (flowData?.profit ?? 0) >= 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.14)" }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.pulseDot} />
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.symbolText}>{flowData?.symbol || target?.symbol || "FLOW"}</Text>
                  {flowData?.type && (
                    <View style={[styles.typeBadge, { backgroundColor: flowData.type === "BUY" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)" }]}>
                      <Text style={[styles.typeText, { color: flowData.type === "BUY" ? "#10b981" : "#ef4444" }]}>
                        {flowData.type} {flowData.volume ? `${flowData.volume}L` : ""}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.subtitle}>
                  {target?.ticket ? `Ticket #${target.ticket}` : (target?.id ? `Señal ${target.id.slice(0, 8)}` : "MT5 Real-Time Feed")}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {flowData?.profit !== undefined ? (
                <View style={[styles.profitBadge, { backgroundColor: isProfit ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }]}>
                  <Text style={[styles.profitText, { color: isProfit ? "#10b981" : "#ef4444" }]}>
                    {profitSign}${flowData.profit.toFixed(2)}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Telemetry Bar */}
          <View style={styles.telemetryBar}>
            {flowData?.entry ? (
              <View style={styles.telemetryPill}>
                <Text style={[styles.pillLabel, { color: "#10b981" }]}>Entry:</Text>
                <Text style={styles.pillValue}>{flowData.entry.toFixed(5)}</Text>
              </View>
            ) : null}
            {flowData?.sl ? (
              <View style={styles.telemetryPill}>
                <Text style={[styles.pillLabel, { color: "#ef4444" }]}>SL:</Text>
                <Text style={styles.pillValue}>{flowData.sl.toFixed(5)}</Text>
              </View>
            ) : null}
            {flowData?.tp ? (
              <View style={styles.telemetryPill}>
                <Text style={[styles.pillLabel, { color: "#38bdf8" }]}>TP:</Text>
                <Text style={styles.pillValue}>{flowData.tp.toFixed(5)}</Text>
              </View>
            ) : null}
            {flowData?.current_price ? (
              <View style={[styles.telemetryPill, { marginLeft: "auto" }]}>
                <Text style={[styles.pillLabel, { color: "#00ff88" }]}>Actual:</Text>
                <Text style={[styles.pillValue, { color: "#00ff88", fontWeight: "700" }]}>
                  {flowData.current_price.toFixed(5)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Chart Canvas */}
          <View style={styles.chartContainer}>
            {loading && candles.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#00ff88" />
                <Text style={styles.loadingText}>
                  {isEs ? "Cargando velas de MT5 en vivo..." : "Loading MT5 live candles..."}
                </Text>
              </View>
            ) : error && candles.length === 0 ? (
              <View style={styles.loadingBox}>
                <Feather name="alert-triangle" size={24} color="#ef4444" />
                <Text style={[styles.loadingText, { color: "#ef4444" }]}>{error}</Text>
              </View>
            ) : (
              <Svg width={chartWidth} height={chartHeight}>
                {/* Horizontal grid lines & Y labels */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
                  const p = minPrice + priceRange * ratio;
                  const y = plotHeight - ratio * plotHeight;
                  return (
                    <React.Fragment key={`grid-${ratio}`}>
                      <Line
                        x1={0}
                        y1={y}
                        x2={plotWidth}
                        y2={y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={1}
                      />
                      <SvgText
                        x={plotWidth + 6}
                        y={y + 3}
                        fill="#64748b"
                        fontSize={9}
                        fontFamily={Platform.OS === "ios" ? "Menlo" : "monospace"}
                      >
                        {p.toFixed(5)}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                {/* Entry Price Line */}
                {flowData?.entry && flowData.entry > 0 ? (
                  <>
                    <Line
                      x1={0}
                      y1={getY(flowData.entry)}
                      x2={plotWidth}
                      y2={getY(flowData.entry)}
                      stroke="#10b981"
                      strokeWidth={1.5}
                      strokeDasharray="4, 3"
                    />
                    <SvgText
                      x={plotWidth + 4}
                      y={getY(flowData.entry) + 3}
                      fill="#10b981"
                      fontSize={8}
                      fontWeight="bold"
                      fontFamily={Platform.OS === "ios" ? "Menlo" : "monospace"}
                    >
                      ENTRY
                    </SvgText>
                  </>
                ) : null}

                {/* Stop Loss Line */}
                {flowData?.sl && flowData.sl > 0 ? (
                  <>
                    <Line
                      x1={0}
                      y1={getY(flowData.sl)}
                      x2={plotWidth}
                      y2={getY(flowData.sl)}
                      stroke="#ef4444"
                      strokeWidth={1.5}
                    />
                    <SvgText
                      x={plotWidth + 4}
                      y={getY(flowData.sl) + 3}
                      fill="#ef4444"
                      fontSize={8}
                      fontWeight="bold"
                      fontFamily={Platform.OS === "ios" ? "Menlo" : "monospace"}
                    >
                      SL
                    </SvgText>
                  </>
                ) : null}

                {/* Take Profit Line */}
                {flowData?.tp && flowData.tp > 0 ? (
                  <>
                    <Line
                      x1={0}
                      y1={getY(flowData.tp)}
                      x2={plotWidth}
                      y2={getY(flowData.tp)}
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                    />
                    <SvgText
                      x={plotWidth + 4}
                      y={getY(flowData.tp) + 3}
                      fill="#38bdf8"
                      fontSize={8}
                      fontWeight="bold"
                      fontFamily={Platform.OS === "ios" ? "Menlo" : "monospace"}
                    >
                      TP
                    </SvgText>
                  </>
                ) : null}

                {/* Candlesticks */}
                {candles.map((c, i) => {
                  const xCenter = i * candleSlotWidth + candleSlotWidth / 2;
                  const isUp = c.close >= c.open;
                  const candleColor = isUp ? "#00ff88" : "#ef4444";
                  const wickY1 = getY(c.high);
                  const wickY2 = getY(c.low);
                  const bodyTop = getY(Math.max(c.open, c.close));
                  const bodyHeight = Math.max(2, Math.abs(getY(c.open) - getY(c.close)));

                  return (
                    <React.Fragment key={`c-${c.time}-${i}`}>
                      {/* High-Low Wick */}
                      <Line
                        x1={xCenter}
                        y1={wickY1}
                        x2={xCenter}
                        y2={wickY2}
                        stroke={candleColor}
                        strokeWidth={1}
                      />
                      {/* Body */}
                      <Rect
                        x={xCenter - candleBodyWidth / 2}
                        y={bodyTop}
                        width={candleBodyWidth}
                        height={bodyHeight}
                        fill={candleColor}
                        rx={1}
                      />
                    </React.Fragment>
                  );
                })}
              </Svg>
            )}
          </View>

          {/* Legend Footer */}
          <View style={styles.footer}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#10b981" }]} />
                <Text style={styles.legendText}>Entry</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                <Text style={styles.legendText}>SL</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#38bdf8" }]} />
                <Text style={styles.legendText}>TP</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#00ff88" }]} />
                <Text style={styles.legendText}>Bull</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>{isEs ? "Cerrar" : "Close"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00ff88",
    shadowColor: "#00ff88",
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  symbolText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  profitText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  telemetryBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  telemetryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 4,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  pillValue: {
    color: "#cbd5e1",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  chartContainer: {
    height: 250,
    backgroundColor: "#090d16",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 11,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  legendRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    color: "#94a3b8",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
