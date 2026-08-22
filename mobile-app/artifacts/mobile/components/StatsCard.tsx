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

  const iconColor = accent ?? colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      {subValue ? (
        <Text style={[styles.subValue, { color: trendColor }]}>{subValue}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    minWidth: 0,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
    lineHeight: 24,
  },
  subValue: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
});
