import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import type { Signal } from "@/context/TradingContext";

interface Props {
  signal: Signal;
  onAccept?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function SignalCard({ signal, onAccept, onReject }: Props) {
  const colors = useColors();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const isBuy = signal.type === "BUY";
  const typeColor = isBuy ? colors.buy : colors.sell;
  const isPending = signal.status === "pending";
  const isActive = signal.status === "active";
  const isRejected = signal.status === "rejected";

  const statusColors: Record<Signal["status"], string> = {
    pending: colors.pending,
    active: colors.profit,
    closed: colors.mutedForeground,
    rejected: colors.loss,
  };

  const handleAccept = async () => {
    if (!onAccept || accepting) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAccepting(true);
    try {
      await onAccept(signal.id);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || rejecting) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRejecting(true);
    try {
      await onReject(signal.id);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isPending ? colors.pending : colors.border,
          borderWidth: isPending ? 1.5 : 1,
        },
      ]}
    >
      {isPending && (
        <View style={[styles.pendingBadge, { backgroundColor: `${colors.pending}20` }]}>
          <View style={[styles.pulseDot, { backgroundColor: colors.pending }]} />
          <Text style={[styles.pendingText, { color: colors.pending }]}>REQUIRES ACTION</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.symbol, { color: colors.foreground }]}>{signal.symbol}</Text>
          <View style={[styles.typeBadge, { backgroundColor: `${typeColor}20` }]}>
            <Text style={[styles.typeText, { color: typeColor }]}>{signal.type}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[signal.status] }]} />
          <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
            {formatTimeAgo(signal.timestamp)}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.dataGrid}>
        <DataRow label="Entry" value={signal.entry.toFixed(signal.symbol.includes("JPY") || signal.symbol.includes("XAU") ? 3 : 5)} />
        <DataRow label="TP" value={signal.takeProfit.toFixed(signal.symbol.includes("JPY") || signal.symbol.includes("XAU") ? 3 : 5)} color={colors.profit} />
        <DataRow label="SL" value={signal.stopLoss.toFixed(signal.symbol.includes("JPY") || signal.symbol.includes("XAU") ? 3 : 5)} color={colors.loss} />
        <DataRow label="R:R" value={`1:${signal.rrRatio.toFixed(2)}`} />
        <DataRow label="Lot" value={signal.lot.toFixed(2)} />
      </View>

      {isPending && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, { borderColor: colors.loss }]}
            onPress={handleReject}
            disabled={rejecting}
            activeOpacity={0.75}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color={colors.loss} />
            ) : (
              <>
                <Feather name="x" size={18} color={colors.loss} />
                <Text style={[styles.rejectText, { color: colors.loss }]}>RECHAZAR</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn, { backgroundColor: colors.profit }]}
            onPress={handleAccept}
            disabled={accepting}
            activeOpacity={0.75}
          >
            {accepting ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="check" size={18} color={colors.primaryForeground} />
                <Text style={[styles.acceptText, { color: colors.primaryForeground }]}>
                  ACEPTAR
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isActive && (
        <View style={[styles.statusBar, { backgroundColor: `${colors.profit}15` }]}>
          <Feather name="activity" size={12} color={colors.profit} />
          <Text style={[styles.statusBarText, { color: colors.profit }]}>ORDEN ACTIVA</Text>
        </View>
      )}

      {isRejected && (
        <View style={[styles.statusBar, { backgroundColor: `${colors.loss}15` }]}>
          <Feather name="slash" size={12} color={colors.loss} />
          <Text style={[styles.statusBarText, { color: colors.loss }]}>RECHAZADA</Text>
        </View>
      )}
    </View>
  );
}

function DataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={styles.dataRow}>
      <Text style={[styles.dataLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: color ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pendingText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  symbol: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  timeAgo: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  dataGrid: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dataLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dataValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  rejectBtn: {
    borderWidth: 1.5,
  },
  acceptBtn: {},
  rejectText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  acceptText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusBarText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
});
