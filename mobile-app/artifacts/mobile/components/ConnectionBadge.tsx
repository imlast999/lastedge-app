import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  connected: boolean;
  uptime: string;
}

export function ConnectionBadge({ connected, uptime }: Props) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!connected) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [connected, pulse]);

  const dotColor = connected ? colors.connected : colors.disconnected;
  const label = connected ? "MT5 CONECTADO" : "MT5 DESCONECTADO";

  return (
    <View style={[styles.badge, { backgroundColor: `${dotColor}15`, borderColor: `${dotColor}30` }]}>
      <Animated.View
        style={[styles.dot, { backgroundColor: dotColor, opacity: connected ? pulse : 1 }]}
      />
      <Text style={[styles.label, { color: dotColor }]}>{label}</Text>
      {connected && (
        <Text style={[styles.uptime, { color: colors.mutedForeground }]}>· {uptime}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  uptime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
