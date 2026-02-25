import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { sendPasswordReset } from "@/features/auth/service";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoInput } from "@/shared/ui/neo-primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const requestReset = async () => {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    const result = await sendPasswordReset(email.trim());

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.errorMessage ?? "Failed to send reset link.");
      return;
    }

    setMessage("Reset link sent. Check your inbox and open the email link.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Enter your account email to receive a reset link.</Text>

      <NeoInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="Email"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <NeoButton
        variant="primary"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        onPress={requestReset}
        disabled={isSubmitting}
        label={isSubmitting ? "Sending..." : "Send link"}
      />

      <Link href="/" asChild>
        <Pressable>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </Link>
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
  subtitle: {
    fontSize: 16,
    color: neoColors.muted,
    textAlign: "center"
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
    backgroundColor: neoColors.primary,
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
  },
  link: {
    color: neoColors.primary
  }
});
