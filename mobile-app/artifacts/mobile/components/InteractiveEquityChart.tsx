/**
 * InteractiveEquityChart — Equity curve interactiva para el Research Dashboard.
 *
 * Renderizado: react-native-svg (ya instalado, sin dependencias nuevas).
 * Interactividad: PanResponder nativo — funciona en Android, iOS y Web.
 *
 * Características:
 *   - Curva de equity acumulada coloreada (verde/rojo según resultado final)
 *   - Área de drawdown sombreada bajo la curva
 *   - Marcadores de nuevos máximos (triángulos verdes)
 *   - Tooltip al tocar: trade #N, equity, drawdown, resultado, MAE/MFE
 *   - Línea de referencia en equity = 0
 *   - Eje Y con valores min/max
 *   - Header con estadísticas resumidas (equity final, max DD, wins, losses)
 *
 * Props:
 *   data        — EquityCurveData del endpoint /equity
 *   height      — altura del área del gráfico (default 200)
 *   onPointPress — callback opcional al seleccionar un punto
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import type { EquityCurveData, EquityCurvePoint } from "@/services/researchApi";

// ── Constantes de layout ──────────────────────────────────────────────────────
const PADDING_LEFT   = 48;  // espacio para etiquetas Y
const PADDING_RIGHT  = 12;
const PADDING_TOP    = 12;
const PADDING_BOTTOM = 24;  // espacio para etiquetas X (n° trade)

interface Props {
  data: EquityCurveData;
  height?: number;
  onPointPress?: (point: EquityCurvePoint) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPips(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
}

function fmtShort(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
}

// ── Componente principal ──────────────────────────────────────────────────────

export function InteractiveEquityChart({ data, height = 200, onPointPress }: Props) {
  const colors = useColors();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const containerWidth = useRef(0);

  const { points } = data;
  const n = points.length;

  // ── Calcular rango Y ──────────────────────────────────────────────────────
  const { minY, maxY, chartW, chartH } = useMemo(() => {
    if (n < 2) return { minY: 0, maxY: 1, chartW: 300, chartH: height - PADDING_TOP - PADDING_BOTTOM };
    const equities = points.map(p => p.equity);
    const rawMin = Math.min(...equities, 0);  // siempre incluir 0
    const rawMax = Math.max(...equities);
    const pad = (rawMax - rawMin) * 0.05 || 10;
    return {
      minY:   rawMin - pad,
      maxY:   rawMax + pad,
      chartW: Math.max(1, (containerWidth.current || 300) - PADDING_LEFT - PADDING_RIGHT),
      chartH: height - PADDING_TOP - PADDING_BOTTOM,
    };
  }, [points, n, height]);

  // ── Mapear coordenadas ────────────────────────────────────────────────────
  const toX = useCallback((i: number) =>
    PADDING_LEFT + (i / Math.max(n - 1, 1)) * chartW,
  [n, chartW]);

  const toY = useCallback((equity: number) => {
    const range = maxY - minY || 1;
    return PADDING_TOP + (1 - (equity - minY) / range) * chartH;
  }, [minY, maxY, chartH]);

  // ── Construir path SVG de la curva ────────────────────────────────────────
  const { linePath, areaPath, ddAreaPath } = useMemo(() => {
    if (n < 2) return { linePath: "", areaPath: "", ddAreaPath: "" };

    let line = `M ${toX(0)} ${toY(points[0].equity)}`;
    let area = `M ${toX(0)} ${toY(0)} L ${toX(0)} ${toY(points[0].equity)}`;
    let ddArea = "";

    for (let i = 1; i < n; i++) {
      line += ` L ${toX(i)} ${toY(points[i].equity)}`;
      area += ` L ${toX(i)} ${toY(points[i].equity)}`;
    }
    area += ` L ${toX(n - 1)} ${toY(0)} Z`;

    // Área de drawdown: región entre equity y el pico anterior
    let peakEquity = points[0].equity;
    let inDD = false;
    let ddPath = "";
    for (let i = 0; i < n; i++) {
      const eq = points[i].equity;
      if (eq > peakEquity) peakEquity = eq;
      const dd = peakEquity - eq;
      if (dd > 0.5) {  // umbral mínimo para dibujar
        if (!inDD) {
          ddPath += `M ${toX(i)} ${toY(peakEquity)} L ${toX(i)} ${toY(eq)}`;
          inDD = true;
        } else {
          ddPath += ` L ${toX(i)} ${toY(eq)}`;
        }
      } else {
        if (inDD) {
          const prev = points[i - 1];
          ddPath += ` L ${toX(i - 1)} ${toY(peakEquity)} Z`;
          inDD = false;
        }
      }
    }
    if (inDD) ddPath += ` L ${toX(n - 1)} ${toY(peakEquity)} Z`;

    return { linePath: line, areaPath: area, ddAreaPath: ddPath };
  }, [points, n, toX, toY]);

  // ── Posición Y de la línea cero ───────────────────────────────────────────
  const zeroY = toY(0);
  const isAboveZero = zeroY > PADDING_TOP && zeroY < height - PADDING_BOTTOM;

  // ── Color de la curva ─────────────────────────────────────────────────────
  const finalEq    = points[n - 1]?.equity ?? 0;
  const lineColor  = finalEq >= 0 ? colors.profit : colors.loss;
  const areaColor  = finalEq >= 0 ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)";

  // ── PanResponder para interactividad ─────────────────────────────────────
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const w = containerWidth.current - PADDING_LEFT - PADDING_RIGHT;
      if (w <= 0 || n < 2) return;
      const ratio = Math.max(0, Math.min(1, (x - PADDING_LEFT) / w));
      const idx   = Math.round(ratio * (n - 1));
      setSelectedIdx(Math.max(0, Math.min(n - 1, idx)));
      onPointPress?.(points[Math.max(0, Math.min(n - 1, idx))]);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const w = containerWidth.current - PADDING_LEFT - PADDING_RIGHT;
      if (w <= 0 || n < 2) return;
      const ratio = Math.max(0, Math.min(1, (x - PADDING_LEFT) / w));
      const idx   = Math.round(ratio * (n - 1));
      setSelectedIdx(Math.max(0, Math.min(n - 1, idx)));
    },
    onPanResponderRelease: () => {},
  }), [n, points, onPointPress]);

  const selectedPt = selectedIdx != null ? points[selectedIdx] : null;

  // ── Etiquetas del eje Y ───────────────────────────────────────────────────
  const yLabels = useMemo(() => {
    const steps = 4;
    const labels: { value: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const v = minY + (maxY - minY) * (i / steps);
      labels.push({ value: v, y: toY(v) });
    }
    return labels;
  }, [minY, maxY, toY]);

  return (
    <View
      style={[styles.container, { height: height + 8 }]}
      onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
      {...panResponder.panHandlers}
    >
      <Svg
        width="100%"
        height={height}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* ── Líneas de cuadrícula horizontales ── */}
        {yLabels.map((l, i) => (
          <Line
            key={i}
            x1={PADDING_LEFT}
            x2="100%"
            y1={l.y}
            y2={l.y}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}

        {/* ── Línea de referencia en 0 ── */}
        {isAboveZero && (
          <Line
            x1={PADDING_LEFT} x2="100%"
            y1={zeroY} y2={zeroY}
            stroke={colors.mutedForeground}
            strokeWidth={1}
            strokeDasharray="6,3"
          />
        )}

        {/* ── Área de drawdown ── */}
        {ddAreaPath !== "" && (
          <Path
            d={ddAreaPath}
            fill="rgba(248,113,113,0.12)"
            stroke="none"
          />
        )}

        {/* ── Área bajo la curva ── */}
        {areaPath !== "" && (
          <Path d={areaPath} fill="url(#equityGrad)" stroke="none" />
        )}

        {/* ── Línea principal ── */}
        {linePath !== "" && (
          <Path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* ── Nuevos máximos: triángulos pequeños ── */}
        {points.map((pt, i) => {
          if (!pt.is_new_high) return null;
          const x = toX(i);
          const y = toY(pt.equity) - 8;
          return (
            <Polygon
              key={`nh-${i}`}
              points={`${x},${y} ${x - 4},${y + 7} ${x + 4},${y + 7}`}
              fill={colors.profit}
              opacity={0.8}
            />
          );
        })}

        {/* ── Punto seleccionado ── */}
        {selectedPt != null && selectedIdx != null && (
          <>
            {/* Línea vertical */}
            <Line
              x1={toX(selectedIdx)} x2={toX(selectedIdx)}
              y1={PADDING_TOP} y2={height - PADDING_BOTTOM}
              stroke={colors.primary}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            {/* Punto en la curva */}
            <Circle
              cx={toX(selectedIdx)}
              cy={toY(selectedPt.equity)}
              r={5}
              fill={selectedPt.result === "WIN" ? colors.profit : colors.loss}
              stroke={colors.background}
              strokeWidth={2}
            />
          </>
        )}

        {/* ── Etiquetas eje Y ── */}
        {yLabels.filter((_, i) => i % 2 === 0).map((l, i) => (
          <Svg key={`yl-${i}`} x={0} y={l.y - 6} width={PADDING_LEFT - 4} height={14}>
            <Rect x={0} y={0} width={PADDING_LEFT - 4} height={14} fill="none" />
            <Path
              d=""
              fill={colors.mutedForeground}
            />
          </Svg>
        ))}
      </Svg>

      {/* ── Etiquetas eje Y (texto fuera del SVG para mejor tipografía) ── */}
      {yLabels.filter((_, i) => i % 2 === 0).map((l, i) => (
        <Text
          key={`yt-${i}`}
          style={[styles.axisLabel, { color: colors.mutedForeground, top: l.y - 7 }]}
        >
          {fmtShort(l.value)}
        </Text>
      ))}

      {/* ── Tooltip ── */}
      {selectedPt != null && selectedIdx != null && (
        <TooltipBox
          pt={selectedPt}
          idx={selectedIdx}
          xPx={toX(selectedIdx)}
          chartWidth={containerWidth.current || 300}
          colors={colors}
        />
      )}
    </View>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function TooltipBox({
  pt, idx, xPx, chartWidth, colors,
}: {
  pt:         EquityCurvePoint;
  idx:        number;
  xPx:        number;
  chartWidth: number;
  colors:     ReturnType<typeof useColors>;
}) {
  // Anclar el tooltip a la derecha si el punto está en la mitad izquierda
  const TOOLTIP_W = 148;
  const isLeft    = xPx < chartWidth / 2;
  const left      = isLeft ? xPx + 8 : undefined;
  const right     = !isLeft ? (chartWidth - xPx) + 8 : undefined;

  const pnlColor = pt.result === "WIN" ? colors.profit : colors.loss;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        { backgroundColor: colors.card, borderColor: colors.border, width: TOOLTIP_W },
        left  != null ? { left }  : {},
        right != null ? { right } : {},
      ]}
    >
      {/* Encabezado: trade # y resultado */}
      <View style={styles.tooltipHeader}>
        <Text style={[styles.tooltipTrade, { color: colors.mutedForeground }]}>
          Trade #{idx + 1}
        </Text>
        <View style={[styles.tooltipResultBadge, { backgroundColor: `${pnlColor}20` }]}>
          <Text style={[styles.tooltipResultText, { color: pnlColor }]}>
            {pt.result}
          </Text>
        </View>
      </View>

      {/* Equity acumulada */}
      <View style={styles.tooltipRow}>
        <Text style={[styles.tooltipKey, { color: colors.mutedForeground }]}>Equity</Text>
        <Text style={[styles.tooltipVal, { color: pt.equity >= 0 ? colors.profit : colors.loss }]}>
          {fmtPips(pt.equity)} p
        </Text>
      </View>

      {/* P&L del trade */}
      <View style={styles.tooltipRow}>
        <Text style={[styles.tooltipKey, { color: colors.mutedForeground }]}>Trade P&L</Text>
        <Text style={[styles.tooltipVal, { color: pnlColor }]}>
          {fmtPips(pt.profit_pips)} p
        </Text>
      </View>

      {/* Drawdown */}
      {pt.drawdown > 0.5 && (
        <View style={styles.tooltipRow}>
          <Text style={[styles.tooltipKey, { color: colors.mutedForeground }]}>Drawdown</Text>
          <Text style={[styles.tooltipVal, { color: colors.loss }]}>
            -{pt.drawdown.toFixed(0)} p
          </Text>
        </View>
      )}

      {/* MAE / MFE */}
      <View style={[styles.tooltipDivider, { backgroundColor: colors.border }]} />
      <View style={styles.tooltipRow}>
        <Text style={[styles.tooltipKey, { color: colors.mutedForeground }]}>MAE</Text>
        <Text style={[styles.tooltipVal, { color: colors.foreground }]}>
          {pt.mae_pips.toFixed(1)} p
        </Text>
      </View>
      <View style={styles.tooltipRow}>
        <Text style={[styles.tooltipKey, { color: colors.mutedForeground }]}>MFE</Text>
        <Text style={[styles.tooltipVal, { color: colors.foreground }]}>
          {pt.mfe_pips.toFixed(1)} p
        </Text>
      </View>

      {/* Duración */}
      <View style={styles.tooltipRow}>
        <Text style={[styles.tooltipKey, { color: colors.mutedForeground }]}>Duración</Text>
        <Text style={[styles.tooltipVal, { color: colors.foreground }]}>
          {pt.duration_bars} H1
        </Text>
      </View>

      {/* Nuevo máximo */}
      {pt.is_new_high && (
        <Text style={[styles.tooltipNewHigh, { color: colors.profit }]}>
          ▲ Nuevo máximo
        </Text>
      )}
    </View>
  );
}

// ── Header de estadísticas ────────────────────────────────────────────────────

export function EquityCurveHeader({
  data,
  colors,
}: {
  data:   EquityCurveData;
  colors: ReturnType<typeof useColors>;
}) {
  const wr = data.total_trades > 0
    ? ((data.wins / data.total_trades) * 100).toFixed(1)
    : "0.0";
  const equityColor = data.final_equity >= 0 ? colors.profit : colors.loss;

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerStat}>
        <Text style={[styles.headerVal, { color: equityColor }]}>
          {fmtPips(data.final_equity)} p
        </Text>
        <Text style={[styles.headerKey, { color: colors.mutedForeground }]}>Equity final</Text>
      </View>
      <View style={[styles.headerSep, { backgroundColor: colors.border }]} />
      <View style={styles.headerStat}>
        <Text style={[styles.headerVal, { color: colors.loss }]}>
          -{data.max_drawdown.toFixed(0)} p
        </Text>
        <Text style={[styles.headerKey, { color: colors.mutedForeground }]}>Max DD</Text>
      </View>
      <View style={[styles.headerSep, { backgroundColor: colors.border }]} />
      <View style={styles.headerStat}>
        <Text style={[styles.headerVal, { color: colors.foreground }]}>{wr}%</Text>
        <Text style={[styles.headerKey, { color: colors.mutedForeground }]}>WR</Text>
      </View>
      <View style={[styles.headerSep, { backgroundColor: colors.border }]} />
      <View style={styles.headerStat}>
        <Text style={[styles.headerVal, { color: colors.profit }]}>{data.new_highs}</Text>
        <Text style={[styles.headerKey, { color: colors.mutedForeground }]}>Máximos</Text>
      </View>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
  },
  axisLabel: {
    position:   "absolute",
    left:       2,
    width:      PADDING_LEFT - 6,
    fontSize:   9,
    fontFamily: "Inter_400Regular",
    fontVariant: ["tabular-nums"],
    textAlign:  "right",
  },
  tooltip: {
    position:     "absolute",
    top:          PADDING_TOP + 4,
    borderRadius: 10,
    borderWidth:  1,
    padding:      10,
    gap:          4,
    zIndex:       10,
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation:    6,
  },
  tooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  tooltipTrade: {
    fontSize:   10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tooltipResultBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      4,
  },
  tooltipResultText: {
    fontSize:   9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  tooltipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems:    "center",
  },
  tooltipKey: {
    fontSize:   10,
    fontFamily: "Inter_400Regular",
  },
  tooltipVal: {
    fontSize:   11,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  tooltipDivider: {
    height:       1,
    marginVertical: 3,
  },
  tooltipNewHigh: {
    fontSize:   9,
    fontFamily: "Inter_600SemiBold",
    marginTop:  2,
    textAlign:  "center",
  },

  // Header
  headerRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-around",
    paddingVertical: 12,
  },
  headerStat: {
    alignItems: "center",
    gap:        2,
    flex:       1,
  },
  headerVal: {
    fontSize:   16,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  headerKey: {
    fontSize:   9,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing:  0.4,
  },
  headerSep: {
    width:    1,
    height:   28,
    marginHorizontal: 4,
  },
});
