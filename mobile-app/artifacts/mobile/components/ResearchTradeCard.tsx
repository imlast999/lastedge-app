/**
 * ResearchTradeCard — Tarjeta de trade individual para la Trade Timeline.
 *
 * Muestra más información que el TradeCard estándar (que es para trades en vivo):
 *   - Número ordinal del trade (#N)
 *   - Resultado WIN/LOSS con P&L en pips
 *   - Equity acumulada en ese punto + drawdown si existe
 *   - MAE y MFE con barras visuales relativas al máximo de la sesión
 *   - Profit Captured % (avg_win / mfe_pips)
 *   - Duración en barras H1
 *   - Indicador de nuevo máximo histórico
 *
 * Es un componente de solo lectura — sin acciones accept/reject.
 */
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { ResearchTrade } from "@/services/researchApi";

interface Props {
  trade:       ResearchTrade;
  /** Máximo MAE del conjunto para normalizar las barras */
  maxMae?:     number;
  /** Máximo MFE del conjunto para normalizar las barras */
  maxMfe?:     number;
  /** Si true, muestra el bloque expandido por defecto */
  defaultOpen?: boolean;
}

const fmt = (v: number, d = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;
const fmtAbs = (v: number, d = 1) => v.toFixed(d);

export function ResearchTradeCard({ trade, maxMae = 100, maxMfe = 100, defaultOpen = false }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(defaultOpen);

  const isWin     = trade.result === "WIN";
  const resultColor = isWin ? colors.profit : colors.loss;
  const hasDD     = trade.drawdown > 0.5;

  // Profit Captured: cuánto del MFE capturó el trade (solo relevante en WIN)
  const profitCaptured = isWin && trade.mfe_pips > 0
    ? Math.min(100, (trade.profit_pips / trade.mfe_pips) * 100)
    : null;

  // Normalización de barras MAE/MFE (0-100% relativo al máximo de la sesión)
  const maeBarW = maxMae > 0 ? Math.min(100, (trade.mae_pips / maxMae) * 100) : 0;
  const mfeBarW = maxMfe > 0 ? Math.min(100, (trade.mfe_pips / maxMfe) * 100) : 0;

  return (
    <Pressable
      onPress={() => setExpanded(v => !v)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isWin ? `${colors.profit}30` : `${colors.loss}30`,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {/* ── Barra de acento lateral ── */}
      <View style={[styles.accent, { backgroundColor: resultColor }]} />

      <View style={styles.body}>
        {/* ── Fila principal ── */}
        <View style={styles.mainRow}>
          {/* Trade # y resultado */}
          <View style={styles.leftCol}>
            <View style={styles.tradeNumRow}>
              <Text style={[styles.tradeNum, { color: colors.mutedForeground }]}>
                #{trade.trade_index}
              </Text>
              {trade.is_new_high && (
                <View style={[styles.newHighBadge, { backgroundColor: `${colors.profit}20` }]}>
                  <Text style={[styles.newHighText, { color: colors.profit }]}>▲ MAX</Text>
                </View>
              )}
            </View>
            <View style={[styles.resultBadge, { backgroundColor: `${resultColor}15` }]}>
              <Text style={[styles.resultText, { color: resultColor }]}>{trade.result}</Text>
            </View>
          </View>

          {/* P&L + equity */}
          <View style={styles.rightCol}>
            <Text style={[styles.pnl, { color: resultColor }]}>
              {fmt(trade.profit_pips)} p
            </Text>
            <Text style={[styles.equity, { color: trade.equity >= 0 ? colors.profit : colors.loss }]}>
              Equity: {fmt(trade.equity, 0)} p
            </Text>
          </View>

          {/* Chevron expand */}
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.mutedForeground}
            style={{ marginLeft: 4 }}
          />
        </View>

        {/* ── Fila rápida: duración + DD ── */}
        <View style={styles.quickRow}>
          <QuickStat
            label={`${trade.duration_bars} H1`}
            icon="clock"
            colors={colors}
          />
          {hasDD && (
            <QuickStat
              label={`DD -${fmtAbs(trade.drawdown, 0)} p`}
              icon="trending-down"
              color={colors.loss}
              colors={colors}
            />
          )}
          {profitCaptured != null && (
            <QuickStat
              label={`Cap. ${profitCaptured.toFixed(0)}%`}
              icon="percent"
              color={profitCaptured >= 70 ? colors.profit : colors.pending}
              colors={colors}
            />
          )}
        </View>

        {/* ── Detalle expandible: MAE/MFE con barras ── */}
        {expanded && (
          <View style={[styles.detail, { borderTopColor: colors.border }]}>
            {/* MAE */}
            <View style={styles.maeMfeRow}>
              <Text style={[styles.maeMfeLabel, { color: colors.mutedForeground }]}>MAE</Text>
              <View style={[styles.barBg, { backgroundColor: colors.secondary }]}>
                <View style={[
                  styles.barFill,
                  { width: `${maeBarW}%` as any, backgroundColor: `${colors.loss}80` },
                ]} />
              </View>
              <Text style={[styles.maeMfeVal, { color: colors.loss }]}>
                {fmtAbs(trade.mae_pips)} p
              </Text>
            </View>

            {/* MFE */}
            <View style={styles.maeMfeRow}>
              <Text style={[styles.maeMfeLabel, { color: colors.mutedForeground }]}>MFE</Text>
              <View style={[styles.barBg, { backgroundColor: colors.secondary }]}>
                <View style={[
                  styles.barFill,
                  { width: `${mfeBarW}%` as any, backgroundColor: `${colors.profit}80` },
                ]} />
              </View>
              <Text style={[styles.maeMfeVal, { color: colors.profit }]}>
                {fmtAbs(trade.mfe_pips)} p
              </Text>
            </View>

            {/* Profit captured barra */}
            {profitCaptured != null && (
              <View style={styles.maeMfeRow}>
                <Text style={[styles.maeMfeLabel, { color: colors.mutedForeground }]}>Cap.</Text>
                <View style={[styles.barBg, { backgroundColor: colors.secondary }]}>
                  <View style={[
                    styles.barFill,
                    {
                      width: `${profitCaptured}%` as any,
                      backgroundColor: profitCaptured >= 70
                        ? `${colors.profit}80`
                        : `${colors.pending}80`,
                    },
                  ]} />
                </View>
                <Text style={[styles.maeMfeVal, {
                  color: profitCaptured >= 70 ? colors.profit : colors.pending,
                }]}>
                  {profitCaptured.toFixed(0)}%
                </Text>
              </View>
            )}

            {/* Barra de contexto: posición de la equity */}
            <View style={[styles.contextRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.contextLabel, { color: colors.mutedForeground }]}>
                Trade #{trade.trade_index} · Barra {trade.bar_index}→{trade.exit_bar}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── QuickStat ─────────────────────────────────────────────────────────────────

function QuickStat({
  label, icon, color, colors,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.quickStat}>
      <Feather name={icon} size={10} color={color ?? colors.mutedForeground} />
      <Text style={[styles.quickStatText, { color: color ?? colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 8,
  },
  accent: { width: 3 },
  body: { flex: 1, padding: 12, gap: 6 },

  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leftCol: { gap: 4, minWidth: 56 },
  rightCol: { flex: 1, alignItems: "flex-end", gap: 2 },

  tradeNumRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tradeNum: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  newHighBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newHighText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  resultBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resultText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },

  pnl: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  equity: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    fontVariant: ["tabular-nums"],
  },

  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  quickStatText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },

  // Detalle expandible
  detail: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 8,
  },
  maeMfeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  maeMfeLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    width: 28,
  },
  barBg: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: "hidden",
  },
  barFill: {
    height: 5,
    borderRadius: 2.5,
  },
  maeMfeVal: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
    width: 44,
    textAlign: "right",
  },

  contextRow: {
    borderTopWidth: 1,
    paddingTop: 6,
  },
  contextLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
});
