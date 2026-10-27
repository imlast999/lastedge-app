import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Line } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useTrading } from "@/context/TradingContext";
import type { EquityPoint } from "@/context/TradingContext";

interface Props {
  data: EquityPoint[];
  height?: number;
  showLabels?: boolean;
}

export function EquityChart({ data, height = 110, showLabels = true }: Props) {
  const colors = useColors();
  const { currencySymbol } = useTrading();

  const { points, minVal, maxVal, isPositive, deltaPct } = useMemo(() => {
    if (data.length < 2) {
      return { points: [], minVal: 0, maxVal: 0, isPositive: true, deltaPct: 0 };
    }
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const startVal = data[0].value;
    const endVal = data[data.length - 1].value;
    const isPos = endVal >= startVal;
    const pct = startVal !== 0 ? ((endVal - startVal) / Math.abs(startVal)) * 100 : 0;

    const pts = data.map((d, i) => ({
      x: (i / (data.length - 1)) * 100,
      y: 100 - ((d.value - min) / range) * 80 - 10,
    }));

    return { points: pts, minVal: min, maxVal: max, isPositive: isPos, deltaPct: pct };
  }, [data]);

  const lineColor = isPositive ? colors.profit : colors.loss;
  const gridColor = colors.border;

  if (points.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={[styles.emptyChart, { borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Accumulating tick data...
          </Text>
        </View>
      </View>
    );
  }

  const chartHeight = height - (showLabels ? 22 : 0);

  const linePathD = points.reduce((acc, pt, i) => {
    return i === 0
      ? `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`
      : `${acc} L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
  }, "");

  const areaPathD = `${linePathD} L 100 100 L 0 100 Z`;
  const lastPt = points[points.length - 1];

  return (
    <View style={[styles.container, { height }]}>
      <View style={[styles.chartArea, { height: chartHeight }]}>
        <Svg width="100%" height={chartHeight} viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={lineColor} stopOpacity={0.16} />
              <Stop offset="100%" stopColor={lineColor} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Cartesian Grid Lines (line-charts.tsx standard) */}
          <Line x1="0" y1="20" x2="100" y2="20" stroke={gridColor} strokeDasharray="3, 3" strokeWidth="0.8" />
          <Line x1="0" y1="50" x2="100" y2="50" stroke={gridColor} strokeDasharray="3, 3" strokeWidth="0.8" />
          <Line x1="0" y1="80" x2="100" y2="80" stroke={gridColor} strokeDasharray="3, 3" strokeWidth="0.8" />

          {/* Area Fill */}
          <Path d={areaPathD} fill="url(#equityGrad)" />

          {/* Equity Line */}
          <Path
            d={linePathD}
            stroke={lineColor}
            strokeWidth={2}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </Svg>

        {/* Precision Endpoint Dot */}
        <View
          style={[
            styles.dotRing,
            {
              left: `${lastPt.x}%` as any,
              top: (lastPt.y / 100) * chartHeight,
              borderColor: lineColor,
              backgroundColor: colors.card,
            },
          ]}
        >
          <View style={[styles.dotCore, { backgroundColor: lineColor }]} />
        </View>
      </View>

      {showLabels && (
        <View style={styles.labels}>
          <Text style={[styles.labelText, { color: colors.mutedForeground }]}>
            {currencySymbol}{minVal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.deltaBadge}>
            <Text
              style={[
                styles.deltaText,
                { color: isPositive ? colors.profit : colors.loss },
              ]}
            >
              {deltaPct >= 0 ? "+" : ""}
              {deltaPct.toFixed(2)}%
            </Text>
          </View>
          <Text style={[styles.labelText, { color: colors.mutedForeground }]}>
            {currencySymbol}{maxVal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  chartArea: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  dotRing: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -5,
    marginTop: -5,
    zIndex: 5,
  },
  dotCore: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 2,
  },
  labelText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
  deltaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  deltaText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  emptyChart: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
