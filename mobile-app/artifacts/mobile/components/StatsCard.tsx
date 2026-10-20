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
}

export function StatsCard({ label, value, subValue, icon, trend, accent }: Props) {
  const colors = useColors();

  const trendColor =
    trend === "up" ? colors.profit : trend === "down" ? colors.loss : colors.mutedForeground;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
          <Feather name={icon} size={13} color={colors.mutedForeground} />
        </View>
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
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
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    minWidth: 0,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  value: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
    lineHeight: 22,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subValue: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
});
