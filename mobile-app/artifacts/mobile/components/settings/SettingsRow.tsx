import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Props {
  icon?: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  loading?: boolean;
  destructive?: boolean;
  isLast?: boolean;
  children?: React.ReactNode;
}

export function SettingsRow({
  icon,
  label,
  value,
  valueColor,
  onPress,
  loading,
  destructive,
  isLast,
  children,
}: Props) {
  const colors = useColors();
  const content = (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
          <Feather
            name={icon}
            size={16}
            color={destructive ? colors.destructive : colors.primary}
          />
        </View>
      )}
      <View style={styles.body}>
        <Text
          style={[
            styles.label,
            { color: destructive ? colors.destructive : colors.foreground },
          ]}
        >
          {label}
        </Text>
        {value !== undefined && (
          <Text
            style={[styles.value, { color: valueColor ?? colors.mutedForeground }]}
            numberOfLines={2}
          >
            {value}
          </Text>
        )}
        {children}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : onPress ? (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.65}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
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
  value: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
