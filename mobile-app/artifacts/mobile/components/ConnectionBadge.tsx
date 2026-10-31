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
  const label = connected ? "MT5 ONLINE" : "MT5 OFFLINE";

  return (
    <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontFamily: "Lokeya",
    letterSpacing: 0.4,
  },
  uptime: {
    fontSize: 10,
    fontFamily: "Lokeya",
  },
});
