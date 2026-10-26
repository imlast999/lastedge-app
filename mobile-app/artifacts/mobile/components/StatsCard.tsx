import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  value: string;
  subValue?: string;
  icon: keyof typeof Feather.glyphMap;
  trend?: "up" | "down" | "neutral";
  accent?: string;
  progress?: number; // 0.0 to 1.0
  progressColor?: string;
  progressLabel?: string;
}

export function StatsCard({
  label,
  value,
  subValue,
  icon,
  trend,
  accent,
  progress,
  progressColor,
  progressLabel,
}: Props) {
  const colors = useColors();

  const trendColor =
    trend === "up" ? colors.profit : trend === "down" ? colors.loss : colors.mutedForeground;

  const barColor = progressColor || accent || colors.primary;
  const clampedProgress = progress !== undefined ? Math.max(0, Math.min(1, progress)) : undefined;

  return (
    <View style={styles.card}>
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: accent ? `${accent}15` : "rgba(255, 255, 255, 0.05)" },
          ]}
        >
          <Feather name={icon} size={14} color={accent || colors.foreground} />
        </View>
      </View>

      {/* Main Big Tabular Value */}
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>

      {/* Progress Bar (High Definition) */}
      {clampedProgress !== undefined ? (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${clampedProgress * 100}%`,
                  backgroundColor: barColor,
                  shadowColor: barColor,
                },
              ]}
            />
          </View>
          {progressLabel ? (
            <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
              {progressLabel}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Footer Subtitle */}
      {subValue ? (
        <View style={styles.footerRow}>
          <Text style={[styles.subValue, { color: trendColor }]}>{subValue}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  progressContainer: {
    marginTop: 2,
    gap: 4,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subValue: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
