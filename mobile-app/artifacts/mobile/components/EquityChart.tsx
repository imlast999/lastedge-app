import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import type { EquityPoint } from "@/context/TradingContext";

interface Props {
  data: EquityPoint[];
  height?: number;
  showLabels?: boolean;
}

export function EquityChart({ data, height = 100, showLabels = true }: Props) {
  const colors = useColors();

  const { points, minVal, maxVal, isPositive } = useMemo(() => {
    if (data.length < 2) return { points: [], minVal: 0, maxVal: 0, isPositive: true };
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const isPos = data[data.length - 1].value >= data[0].value;

    const pts = data.map((d, i) => ({
      x: (i / (data.length - 1)) * 100,
      y: 100 - ((d.value - min) / range) * 90 - 5,
    }));

    return { points: pts, minVal: min, maxVal: max, isPositive: isPos };
  }, [data]);

  const lineColor = isPositive ? colors.profit : colors.loss;

  if (points.length < 2) {
    return <View style={[styles.container, { height }]} />;
  }

  const chartHeight = height - (showLabels ? 24 : 0);

  const linePathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}` : `${acc} L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
  }, "");

  const areaPathD = `${linePathD} L 100 100 L 0 100 Z`;

  const lastPt = points[points.length - 1];

  return (
    <View style={[styles.container, { height }]}>
      <View style={[styles.chartArea, { height: chartHeight }]}>
        <Svg width="100%" height={chartHeight} viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
              <Stop offset="100%" stopColor={lineColor} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>
          <Path d={areaPathD} fill="url(#equityGradient)" />
          <Path
            d={linePathD}
            stroke={lineColor}
            strokeWidth={2}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </Svg>

        <View
          style={[
            styles.dot,
            {
              left: `${lastPt.x}%` as any,
              top: (lastPt.y / 100) * chartHeight,
              backgroundColor: lineColor,
              shadowColor: lineColor,
            },
          ]}
        />
      </View>

      {showLabels && (
        <View style={styles.labels}>
          <Text style={[styles.labelText, { color: colors.mutedForeground }]}>
            {minVal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.labelText, { color: colors.mutedForeground }]}>
            {maxVal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
  dot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    marginTop: -3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  labelText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    fontVariant: ["tabular-nums"],
  },
});
