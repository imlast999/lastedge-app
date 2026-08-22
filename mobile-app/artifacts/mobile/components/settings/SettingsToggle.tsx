import React from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  icon?: keyof typeof Feather.glyphMap;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}

export function SettingsToggle({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
  isLast,
}: Props) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
          <Feather name={icon} size={16} color={colors.primary} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        {description ? (
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: `${colors.primary}88` }}
        thumbColor={value ? colors.primary : colors.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontFamily: "Inter_500Medium" },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
