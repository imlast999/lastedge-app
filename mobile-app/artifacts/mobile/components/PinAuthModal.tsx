import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { resolveApiConfig } from "@/lib/apiConfig";

export const AUTH_STORAGE_KEY = "lastedge_app_auth";

interface PinAuthModalProps {
  visible?: boolean;
  onSuccess?: () => void;
}

export function PinAuthModal({ visible = true, onSuccess }: PinAuthModalProps) {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const caretAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Check stored auth state on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored === "true") {
          setIsAuthenticated(true);
        }
      } catch {
        // Storage fallback
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Blinking Caret Animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caretAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(caretAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [caretAnim]);

  // Trigger pulse on input change
  const triggerPulse = () => {
    pulseAnim.setValue(1);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.15,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handlePinChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "").slice(0, 4);
    setPin(clean);
    setErrorMsg(null);
    triggerPulse();

    if (clean.length === 4) {
      verifyPin(clean);
    }
  };

  const verifyPin = async (candidatePin: string) => {
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const { url } = resolveApiConfig();
      let verified = false;

      // Remote verification attempt
      if (url) {
        try {
          const res = await fetch(`${url}/api/auth/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: candidatePin }),
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            verified = true;
          }
        } catch {
          // If server unreachable, fallback to default PIN 1623
        }
      }

      // Local fallback verification against 1623
      if (!verified && candidatePin === "1623") {
        verified = true;
      }

      if (verified) {
        setIsSuccess(true);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, "true");
        setTimeout(() => {
          setIsAuthenticated(true);
          onSuccess?.();
        }, 600);
      } else {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        triggerShake();
        setErrorMsg("PIN inválido. Intente nuevamente.");
        setTimeout(() => {
          setPin("");
          inputRef.current?.focus();
        }, 500);
      }
    } catch {
      setErrorMsg("Error de verificación.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      handlePinChange(pin + num);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      handlePinChange(pin.slice(0, -1));
    }
  };

  if (isLoading || isAuthenticated) {
    return null;
  }

  return (
    <Modal
      visible={visible && !isAuthenticated}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Background glow ambient */}
        <View style={styles.ambientTop} />
        <View style={styles.ambientBottom} />

        {/* Card Body */}
        <View style={styles.content}>
          {/* Animated Visualizer Shield Header */}
          <View style={styles.visualizerContainer}>
            <View style={styles.outerRing} />
            <View style={styles.midRing} />
            <Animated.View
              style={[
                styles.innerRing,
                { transform: [{ scale: pulseAnim }] },
                isSuccess && styles.innerRingSuccess,
              ]}
            >
              {isSuccess ? (
                <MaterialCommunityIcons name="shield-check" size={48} color="#10B981" />
              ) : (
                <Feather name="shield" size={40} color="#3B82F6" />
              )}
            </Animated.View>
          </View>

          {/* Title & Description */}
          <Text style={styles.title}>
            {isSuccess ? "ACCESO AUTORIZADO" : "LASTEDGE SECURITY PIN"}
          </Text>
          <Text style={styles.subtitle}>
            {isSuccess
              ? "Identidad confirmada. Sincronizando dashboard..."
              : "Ingrese su código PIN de 4 dígitos para acceder al sistema institucional."}
          </Text>

          {/* 4 OTP Slots */}
          <Animated.View
            style={[
              styles.slotsWrapper,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            {[0, 1, 2, 3].map((idx) => {
              const char = pin[idx];
              const isActive = pin.length === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  onPress={() => inputRef.current?.focus()}
                  style={[
                    styles.slot,
                    isSuccess && styles.slotSuccess,
                    isActive && styles.slotActive,
                    errorMsg && styles.slotError,
                  ]}
                >
                  {char ? (
                    <Text style={[styles.slotChar, isSuccess && styles.slotCharSuccess]}>
                      {char}
                    </Text>
                  ) : isActive && !isSuccess ? (
                    <Animated.View style={[styles.caret, { opacity: caretAnim }]} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* Hidden Input for Keyboard input */}
          <TextInput
            ref={inputRef}
            value={pin}
            onChangeText={handlePinChange}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            style={styles.hiddenInput}
            caretHidden
          />

          {/* Error / Verifying Status */}
          <View style={styles.statusBox}>
            {isVerifying ? (
              <View style={styles.verifyingRow}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.statusText}>Verificando firma de seguridad...</Text>
              </View>
            ) : errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : (
              <Text style={styles.hintText}>PIN por defecto: 1623</Text>
            )}
          </View>

          {/* Custom On-Screen Keypad */}
          <View style={styles.keypad}>
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
              ["", "0", "del"],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((btn, bIdx) => {
                  if (btn === "") {
                    return <View key={bIdx} style={styles.keypadKeyEmpty} />;
                  }
                  if (btn === "del") {
                    return (
                      <TouchableOpacity
                        key={bIdx}
                        style={styles.keypadKey}
                        onPress={handleDelete}
                        activeOpacity={0.7}
                      >
                        <Feather name="delete" size={20} color="#94A3B8" />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={bIdx}
                      style={styles.keypadKey}
                      onPress={() => handleKeyPress(btn)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.keypadNumber}>{btn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Utility function to manually lock the app */
export async function lockApp() {
  try {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F17",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  ambientTop: {
    position: "absolute",
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  ambientBottom: {
    position: "absolute",
    bottom: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  content: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  visualizerContainer: {
    width: 110,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  outerRing: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  midRing: {
    position: "absolute",
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  innerRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(59, 130, 246, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  innerRingSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  slotsWrapper: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  slot: {
    width: 58,
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  slotActive: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  slotSuccess: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  slotError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  slotChar: {
    fontSize: 26,
    fontWeight: "700",
    color: "#F8FAFC",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  slotCharSuccess: {
    color: "#10B981",
  },
  caret: {
    width: 2,
    height: 24,
    backgroundColor: "#3B82F6",
    borderRadius: 1,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  statusBox: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  verifyingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: "#60A5FA",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
  },
  hintText: {
    fontSize: 11,
    color: "#64748B",
  },
  keypad: {
    width: "100%",
    maxWidth: 280,
    gap: 12,
    marginTop: 6,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  keypadKey: {
    width: 72,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  keypadKeyEmpty: {
    width: 72,
    height: 56,
  },
  keypadNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F1F5F9",
  },
});
