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
import { useSettings } from "@/context/SettingsContext";

export const AUTH_STORAGE_KEY = "lastedge_app_auth";
export const PIN_STORAGE_KEY = "lastedge_custom_security_pin";

interface PinAuthModalProps {
  visible?: boolean;
  onSuccess?: () => void;
}

type PinMode = "setup_create" | "setup_confirm" | "unlock";

export function PinAuthModal({ visible = true, onSuccess }: PinAuthModalProps) {
  const { settings } = useSettings();
  const isEs = settings?.language === "es";

  const [pin, setPin] = useState("");
  const [createdPinDraft, setCreatedPinDraft] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [mode, setMode] = useState<PinMode>("unlock");

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hintMsg, setHintMsg] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const caretAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Check stored auth state & existing PIN on mount
  useEffect(() => {
    async function checkAuthAndPin() {
      try {
        const [authVal, savedPin] = await Promise.all([
          AsyncStorage.getItem(AUTH_STORAGE_KEY),
          AsyncStorage.getItem(PIN_STORAGE_KEY),
        ]);

        if (savedPin) {
          setStoredPin(savedPin);
          setMode("unlock");
          if (authVal === "true") {
            setIsAuthenticated(true);
          }
        } else {
          // No PIN registered yet -> Must create & confirm new PIN
          setMode("setup_create");
          setIsAuthenticated(false);
        }
      } catch {
        setMode("setup_create");
      } finally {
        setIsLoading(false);
      }
    }
    checkAuthAndPin();
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
      processCompletedPin(clean);
    }
  };

  const processCompletedPin = async (candidatePin: string) => {
    // ── 1. SETUP: Step 1 (Create PIN) ──────────────────────────────────────
    if (mode === "setup_create") {
      setCreatedPinDraft(candidatePin);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      setTimeout(() => {
        setPin("");
        setMode("setup_confirm");
        setHintMsg(isEs ? "Vuelva a introducir los 4 dígitos para confirmar" : "Re-enter the 4 digits to confirm");
      }, 250);
      return;
    }

    // ── 2. SETUP: Step 2 (Confirm PIN) ─────────────────────────────────────
    if (mode === "setup_confirm") {
      if (candidatePin === createdPinDraft) {
        // PINs match! Save new PIN
        setIsVerifying(true);
        try {
          await AsyncStorage.setItem(PIN_STORAGE_KEY, candidatePin);
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, "true");
          setStoredPin(candidatePin);
          setIsSuccess(true);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          setTimeout(() => {
            setIsAuthenticated(true);
            onSuccess?.();
          }, 650);
        } catch {
          setErrorMsg(isEs ? "Error al guardar el PIN." : "Error saving PIN.");
        } finally {
          setIsVerifying(false);
        }
      } else {
        // PINs mismatch -> Reset to Step 1
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
        triggerShake();
        setErrorMsg(isEs ? "Los PINs no coinciden. Inténtelo de nuevo." : "PINs do not match. Please try again.");
        setTimeout(() => {
          setPin("");
          setCreatedPinDraft("");
          setMode("setup_create");
          setHintMsg(null);
        }, 800);
      }
      return;
    }

    // ── 3. UNLOCK: Verify against stored PIN ────────────────────────────────
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const { url } = resolveApiConfig();
      let verified = false;

      // Remote verification attempt if configured
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
          // Network offline / fallback to local PIN
        }
      }

      // Local verification against stored custom PIN (or legacy default 1623 if none stored)
      const targetPin = storedPin || "1623";
      if (!verified && candidatePin === targetPin) {
        verified = true;
      }

      if (verified) {
        setIsSuccess(true);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, "true");
        setTimeout(() => {
          setIsAuthenticated(true);
          onSuccess?.();
        }, 600);
      } else {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
        triggerShake();
        setErrorMsg(isEs ? "PIN inválido. Intente nuevamente." : "Invalid PIN. Please try again.");
        setTimeout(() => {
          setPin("");
          inputRef.current?.focus();
        }, 500);
      }
    } catch {
      setErrorMsg(isEs ? "Error de verificación." : "Verification error.");
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

  if (isLoading || isAuthenticated || !settings.ecosystemSetupCompleted) {
    return null;
  }

  // Titles & subtitles based on current mode
  let headerTitle = "LASTEDGE SECURITY PIN";
  let headerSubtitle = "Enter your 4-digit security PIN to access the terminal.";

  if (isSuccess) {
    headerTitle = isEs ? "ACCESO AUTORIZADO" : "ACCESS AUTHORIZED";
    headerSubtitle = isEs
      ? "PIN verificado correctamente. Sincronizando dashboard..."
      : "Security PIN verified. Synchronizing terminal...";
  } else if (mode === "setup_create") {
    headerTitle = isEs ? "CREAR PIN DE SEGURIDAD" : "CREATE SECURITY PIN";
    headerSubtitle = isEs
      ? "Cree un código PIN de 4 dígitos para proteger su terminal."
      : "Enter a new 4-digit PIN to secure your terminal.";
  } else if (mode === "setup_confirm") {
    headerTitle = isEs ? "CONFIRMAR PIN DE SEGURIDAD" : "CONFIRM SECURITY PIN";
    headerSubtitle = isEs
      ? "Vuelva a introducir su PIN de 4 dígitos para confirmar."
      : "Re-enter your 4-digit PIN to confirm.";
  } else {
    headerTitle = "LASTEDGE SECURITY PIN";
    headerSubtitle = isEs
      ? "Ingrese su código PIN de 4 dígitos para acceder al sistema institucional."
      : "Enter your 4-digit security PIN to access the terminal.";
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
                mode === "setup_confirm" && !isSuccess && styles.innerRingConfirm,
              ]}
            >
              {isSuccess ? (
                <MaterialCommunityIcons name="shield-check" size={48} color="#10B981" />
              ) : mode === "setup_confirm" ? (
                <Feather name="shield" size={40} color="#A855F7" />
              ) : (
                <Feather name="shield" size={40} color="#3B82F6" />
              )}
            </Animated.View>
          </View>

          {/* Mode Step Indicator for First Launch Setup */}
          {mode.startsWith("setup") && !isSuccess && (
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                {mode === "setup_create"
                  ? (isEs ? "PASO 1 DE 2: CREAR PIN" : "STEP 1 OF 2: CREATE PIN")
                  : (isEs ? "PASO 2 DE 2: CONFIRMAR" : "STEP 2 OF 2: CONFIRM PIN")}
              </Text>
            </View>
          )}

          {/* Title & Description */}
          <Text style={styles.title}>{headerTitle}</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>

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
                    mode === "setup_confirm" && !isSuccess && styles.slotConfirm,
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

          {/* Error / Verifying Status / Step Hint */}
          <View style={styles.statusBox}>
            {isVerifying ? (
              <View style={styles.verifyingRow}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.statusText}>
                  {isEs ? "Guardando firma de seguridad..." : "Saving security signature..."}
                </Text>
              </View>
            ) : errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : hintMsg ? (
              <Text style={styles.hintText}>{hintMsg}</Text>
            ) : mode === "setup_create" ? (
              <Text style={styles.hintText}>
                {isEs ? "Elige un código de 4 dígitos fácil de recordar" : "Choose a 4-digit code you will remember"}
              </Text>
            ) : null}
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

/** Utility function to reset PIN (for testing or recovery) */
export async function resetSecurityPin() {
  try {
    await AsyncStorage.removeItem(PIN_STORAGE_KEY);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E14",
    justifyContent: "center",
    alignItems: "center",
  },
  ambientTop: {
    position: "absolute",
    top: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  ambientBottom: {
    position: "absolute",
    bottom: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  content: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  visualizerContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  outerRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.1)",
    borderStyle: "dashed",
  },
  midRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  innerRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(59, 130, 246, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  innerRingConfirm: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  innerRingSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    marginBottom: 10,
  },
  stepBadgeText: {
    color: "#C084FC",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  slotsWrapper: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  slot: {
    width: 58,
    height: 64,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  slotConfirm: {
    borderColor: "rgba(168, 85, 247, 0.2)",
  },
  slotActive: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.05)",
  },
  slotSuccess: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  slotError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  slotChar: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  slotCharSuccess: {
    color: "#10B981",
  },
  caret: {
    width: 2,
    height: 22,
    backgroundColor: "#3B82F6",
    borderRadius: 1,
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  statusBox: {
    minHeight: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  verifyingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "500",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
  },
  hintText: {
    fontSize: 11.5,
    color: "#64748B",
  },
  keypad: {
    width: "100%",
    maxWidth: 280,
    gap: 12,
    marginTop: 4,
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
