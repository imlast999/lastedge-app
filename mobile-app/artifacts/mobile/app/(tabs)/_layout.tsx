import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/context/SettingsContext";

export default function TabLayout() {
  const colors = useColors();
  const { settings } = useSettings();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const showTrading = settings.ecosystemModules?.tradingEngine !== false;
  const showLab = settings.ecosystemModules?.strategyLab !== false;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: 56,
          ...(isWeb ? { height: 68 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Lokeya",
          marginTop: -2,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          href: showTrading ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: "Trades",
          href: showTrading ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.line.uptrend.xyaxis" tintColor={color} size={22} />
            ) : (
              <Feather name="trending-up" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="lab"
        options={{
          title: "Lab",
          href: showLab ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="flask.fill" tintColor={color} size={22} />
            ) : (
              <Feather name={"flask" as any} size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
