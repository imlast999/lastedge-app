import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
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

const TTL_TOTAL_SECONDS = 10 * 60; // 10 minutes

function parseSignalDate(raw?: string | number | null): Date {
  if (!raw) return new Date();
  if (typeof raw === "number") {
    return raw > 1e11 ? new Date(raw) : new Date(raw * 1000);
  }
  let str = String(raw).trim();
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return num > 1e11 ? new Date(num) : new Date(num * 1000);
  }
  str = str.replace(" ", "T");
  if (!str.includes("Z") && !str.includes("+") && !str.slice(10).includes("-")) {
    str += "Z";
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatRelativeTime(secondsAgo: number): string {
  if (secondsAgo < 5) return "justo ahora";
  if (secondsAgo < 60) return `hace ${secondsAgo}s`;
  const mins = Math.floor(secondsAgo / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function SignalCard({ signal, onAccept, onReject }: Props) {
  const colors = useColors();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    try {
      const createdTime = parseSignalDate(signal.timestamp).getTime();
      return Math.max(0, Math.floor((Date.now() - createdTime) / 1000));
    } catch {
      return 0;
    }
  });

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    try {
      const createdTime = parseSignalDate(signal.timestamp).getTime();
      const elapsedSec = Math.floor((Date.now() - createdTime) / 1000);
      return Math.max(0, TTL_TOTAL_SECONDS - elapsedSec);
    } catch {
      return 0;
    }
  });

  // 1-second countdown and elapsed timer interval
  useEffect(() => {
    const update = () => {
      try {
        const createdTime = parseSignalDate(signal.timestamp).getTime();
        const elapsedSec = Math.max(0, Math.floor((Date.now() - createdTime) / 1000));
        setElapsedSeconds(elapsedSec);
        setSecondsRemaining(Math.max(0, TTL_TOTAL_SECONDS - elapsedSec));
      } catch {
        setElapsedSeconds(0);
        setSecondsRemaining(0);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [signal.timestamp]);

  const rawStatus = String(signal.status || "pending").toLowerCase();
  const isBackendExpired = rawStatus === "expired" || rawStatus === "expired_ttl";
  const isTimeExpired = secondsRemaining <= 0;
  const isExpired = isBackendExpired || isTimeExpired;

  const isPending = !isExpired && (rawStatus === "pending" || rawStatus === "proposed");
  const isActive = rawStatus === "active" || rawStatus === "executed" || rawStatus === "accepted";
  const isRejected = rawStatus === "rejected" || rawStatus === "rejected_manual";

  const isBuy = signal.type === "BUY";
  const typeColor = isBuy ? "#3B82F6" : "#F43F5E";

  const sigDate = parseSignalDate(signal.timestamp);
  const exactTimeStr = sigDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const relativeStr = formatRelativeTime(elapsedSeconds);

  const handleAccept = async () => {
    if (!onAccept || accepting || isExpired) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setAccepting(true);
    try {
      await onAccept(signal.id);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || rejecting || isExpired) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRejecting(true);
    try {
      await onReject(signal.id);
    } finally {
      setRejecting(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <View
      style={[
        styles.card,
        isPending && styles.cardPending,
        isExpired && styles.cardExpired,
      ]}
    >
      {/* Top Banner: Pending with TTL Countdown vs Expired Badge */}
      {isPending && (
        <View style={styles.pendingHeader}>
          <View style={styles.pulseRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.pendingTitle}>SEÑAL PENDIENTE · REQUIERE ACCIÓN</Text>
          </View>
          <View style={styles.ttlBadge}>
            <Feather name="clock" size={11} color="#F59E0B" />
            <Text style={styles.ttlText}>
              TTL: {formatCountdown(secondsRemaining)}
            </Text>
          </View>
        </View>
      )}

      {isExpired && (
        <View style={styles.expiredBadge}>
          <Feather name="clock" size={12} color="#F59E0B" />
          <Text style={styles.expiredText}>
            ⏳ SEÑAL EXPIRADA (Sin confirmación tras 10 min)
          </Text>
        </View>
      )}

      {/* Sent Time & Elapsed Counter Row */}
      <View style={styles.timingRow}>
        <View style={styles.timingLeft}>
          <Feather
            name="clock"
            size={12}
            color={isPending ? "#60A5FA" : isActive ? "#34D399" : "#94A3B8"}
          />
          <Text style={styles.exactTimeText}>
            {isPending ? "Enviada:" : "Hora:"} {exactTimeStr}
          </Text>
          <View
            style={[
              styles.relativeChip,
              isActive && { backgroundColor: "rgba(16, 185, 129, 0.15)" },
              isExpired && { backgroundColor: "rgba(255, 255, 255, 0.05)" },
            ]}
          >
            <Text
              style={[
                styles.relativeText,
                isActive && { color: "#34D399" },
                isExpired && { color: "#94A3B8" },
              ]}
            >
              {relativeStr}
            </Text>
          </View>
        </View>

        {isPending && (
          <View
            style={[
              styles.countdownPill,
              secondsRemaining < 180 && styles.countdownPillUrgent,
            ]}
          >
            <Feather
              name="hourglass"
              size={11}
              color={secondsRemaining < 180 ? "#EF4444" : "#F59E0B"}
            />
            <Text
              style={[
                styles.countdownPillText,
                secondsRemaining < 180 && styles.countdownPillTextUrgent,
              ]}
            >
              {formatCountdown(secondsRemaining)}
            </Text>
          </View>
        )}
      </View>

      {/* Main Signal Identification Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.symbol}>{signal.symbol}</Text>
          <View style={[styles.typeBadge, { backgroundColor: `${typeColor}20` }]}>
            <Text style={[styles.typeText, { color: typeColor }]}>{signal.type}</Text>
          </View>
          <View style={styles.strategyBadge}>
            <Text style={styles.strategyText}>{signal.strategy || "AutoSignals"}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.lotText}>
            {Number(signal?.lot ?? 0.01).toFixed(2)} lot
          </Text>
        </View>
      </View>

      {/* Parameters Metric Grid */}
      <View style={styles.dataGrid}>
        <DataRow
          label="Entry"
          value={Number(signal?.entry ?? 0).toFixed(
            (signal?.symbol || "").includes("JPY") || (signal?.symbol || "").includes("XAU") ? 3 : 5
          )}
        />
        <DataRow
          label="TP"
          value={Number(signal?.takeProfit ?? 0).toFixed(
            (signal?.symbol || "").includes("JPY") || (signal?.symbol || "").includes("XAU") ? 3 : 5
          )}
          color="#10B981"
        />
        <DataRow
          label="SL"
          value={Number(signal?.stopLoss ?? 0).toFixed(
            (signal?.symbol || "").includes("JPY") || (signal?.symbol || "").includes("XAU") ? 3 : 5
          )}
          color="#EF4444"
        />
        <DataRow label="R:R" value={`1:${Number(signal?.rrRatio ?? 1).toFixed(2)}`} />
      </View>

      {/* Action Buttons for Pending Signals */}
      {isPending && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={handleReject}
            disabled={rejecting || isExpired}
            activeOpacity={0.75}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Feather name="x-circle" size={17} color="#EF4444" />
                <Text style={styles.rejectText}>❌ Descartar</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={handleAccept}
            disabled={accepting || isExpired}
            activeOpacity={0.75}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check-circle" size={17} color="#FFFFFF" />
                <Text style={styles.acceptText}>✅ Aprobar y Ejecutar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* State Badges for Closed / Active / Rejected */}
      {isActive && (
        <View style={[styles.statusBar, styles.statusActive]}>
          <Feather name="check" size={12} color="#10B981" />
          <Text style={[styles.statusBarText, { color: "#34D399" }]}>
            EJECUTADA EN MT5
          </Text>
        </View>
      )}

      {isRejected && (
        <View style={[styles.statusBar, styles.statusRejected]}>
          <Feather name="slash" size={12} color="#EF4444" />
          <Text style={[styles.statusBarText, { color: "#F87171" }]}>
            DESCARTADA POR USUARIO
          </Text>
        </View>
      )}
    </View>
  );
}

function DataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={[styles.dataValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0B0F17",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    marginBottom: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPending: {
    borderColor: "rgba(59, 130, 246, 0.4)",
    borderWidth: 1.5,
  },
  cardExpired: {
    opacity: 0.75,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  pendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  pulseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#3B82F6",
  },
  pendingTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#60A5FA",
    letterSpacing: 0.4,
  },
  ttlBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  ttlText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FBBF24",
    fontVariant: ["tabular-nums"],
  },
  expiredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  expiredText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FBBF24",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  symbol: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  strategyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  strategyText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  lotText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E2E8F0",
    fontVariant: ["tabular-nums"],
  },
  dataGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  dataRow: {
    alignItems: "center",
    gap: 2,
  },
  dataLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dataValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F8FAFC",
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  rejectText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EF4444",
  },
  acceptBtn: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusRejected: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  statusBarText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  timingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  exactTimeText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontWeight: "700",
    color: "#E2E8F0",
  },
  relativeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  relativeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#60A5FA",
  },
  countdownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  countdownPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FBBF24",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  countdownPillUrgent: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  countdownPillTextUrgent: {
    color: "#F87171",
  },
});
