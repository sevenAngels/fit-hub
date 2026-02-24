import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { sendPasswordReset } from "@/features/auth/service";

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

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="Email"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable style={styles.button} onPress={requestReset} disabled={isSubmitting}>
        <Text style={styles.buttonLabel}>{isSubmitting ? "Sending..." : "Send link"}</Text>
      </Pressable>

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
    backgroundColor: "#f8f6f2"
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2f3a24"
  },
  subtitle: {
    fontSize: 16,
    color: "#55624c",
    textAlign: "center"
  },
  input: {
    width: "100%",
    maxWidth: 360,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d6d8dc",
    backgroundColor: "#ffffff"
  },
  button: {
    marginTop: 16,
    backgroundColor: "#2f6fa8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    minWidth: 180
  },
  buttonLabel: {
    color: "#ffffff",
    fontWeight: "600"
  },
  error: {
    color: "#b00020"
  },
  message: {
    color: "#276749"
  },
  link: {
    color: "#2f6fa8"
  }
});
