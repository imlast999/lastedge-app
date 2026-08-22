/**
 * Sticky banner shown at the top of every screen when the app cannot
 * reach the API server or is displaying mock data.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTrading } from "@/context/TradingContext";
import { useTranslation } from "@/hooks/useTranslation";

export function ApiErrorBanner() {
  const { apiError, usingMockData } = useTrading();
  const { t } = useTranslation();

  if (!apiError && !usingMockData) return null;

  const isMock = usingMockData;

  return (
    <View style={[styles.banner, isMock ? styles.mockBanner : styles.errorBanner]}>
      <Feather
        name={isMock ? "eye-off" : "wifi-off"}
        size={13}
        color="#09090b"
        style={styles.icon}
      />
      <Text style={styles.text} numberOfLines={1}>
        {isMock
          ? t("mockDataBanner")
          : `${t("noServerBanner")}: ${apiError}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  mockBanner: {
    backgroundColor: "#f59e0b",   // amber — warning
  },
  errorBanner: {
    backgroundColor: "#f87171",   // red coral — error
  },
  icon: { marginRight: 6 },
  text: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#09090b",
    flex: 1,
  },
});
