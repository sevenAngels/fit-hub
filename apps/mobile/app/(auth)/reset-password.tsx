import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { updatePassword } from "@/features/auth/service";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoInput } from "@/shared/ui/neo-primitives";

export default function ResetPasswordPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submitPassword = async () => {
    if (!session) {
      setError("No active recovery session. Open the reset link again.");
      return;
    }

    if (!password || password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const result = await updatePassword(password);

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.errorMessage ?? "Could not update password.");
      return;
    }

    setMessage("Password updated successfully");
    router.replace("/(protected)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set a new password</Text>

      <NeoInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="New password"
      />
      <NeoInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholder="Confirm new password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <NeoButton
        variant="primary"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        onPress={submitPassword}
        disabled={isSubmitting}
        label={isSubmitting ? "Updating..." : "Update password"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
    backgroundColor: neoColors.background
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: neoColors.ink
  },
  input: {
    width: "100%",
    maxWidth: 360,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: neoColors.ink,
    backgroundColor: neoColors.white
  },
  button: {
    marginTop: 16,
    backgroundColor: neoColors.successText,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    minWidth: 180
  },
  buttonLabel: {
    color: neoColors.white,
    fontWeight: "600"
  },
  error: {
    color: neoColors.dangerText
  },
  message: {
    color: neoColors.successText
  }
});
