/**
 * Tapable banner shown at the top of screens when the app cannot
 * reach the API server or is displaying demo/mock data.
 */
import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTrading } from "@/context/TradingContext";
import { useTranslation } from "@/hooks/useTranslation";

export function ApiErrorBanner() {
  const { apiError, usingMockData } = useTrading();
  const { t, language } = useTranslation();
  const router = useRouter();

  if (!apiError && !usingMockData) return null;

  const isMock = usingMockData;
  const isEs = language === "es";

  const handlePress = () => {
    router.push("/settings-modal" as any);
  };

  const bannerColor = isMock ? "#10B981" : "#F43F5E";
  const textColor = isMock ? "#A7F3D0" : "#FECDD3";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[
        styles.banner,
        isMock ? styles.mockBanner : styles.errorBanner,
      ]}
    >
      <Feather
        name={isMock ? "box" : "server"}
        size={13}
        color={bannerColor}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
        {isMock
          ? isEs
            ? "Modo Demo Interactivo · Toca para conectar VPS real"
            : "Interactive Demo Sandbox · Tap to link live VPS"
          : (apiError || "VPS Offline — Tap to connect")}
      </Text>
      <Feather
        name="chevron-right"
        size={12}
        color={bannerColor}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  mockBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  errorBanner: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  icon: {
    marginRight: 8,
  },
  chevron: {
    marginLeft: 6,
  },
  text: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    flex: 1,
  },
});
