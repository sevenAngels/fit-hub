import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { signInWithEmail, signUpWithEmail } from "@/features/auth/service";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoInput } from "@/shared/ui/neo-primitives";

export default function AuthHomePage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const submitAuth = async () => {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    const result =
      mode === "sign-in" ? await signInWithEmail(email.trim(), password) : await signUpWithEmail(email.trim(), password);

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.errorMessage ?? "Authentication failed.");
      return;
    }

    if (result.redirectTo === "signup-verify-email") {
      setMessage("Verification email sent. Please verify your email, then sign in.");
      setMode("sign-in");
      return;
    }

    if (result.redirectTo === "onboarding") {
      router.replace("/(protected)/onboarding");
      return;
    }

    router.replace("/(protected)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fit Hub Mobile</Text>
      <Text style={styles.subtitle}>{mode === "sign-in" ? "Sign in to continue" : "Create your account"}</Text>

      <NeoInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        placeholder="Email"
        autoCapitalize="none"
      />
      <NeoInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <NeoButton
        variant="primary"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        onPress={submitAuth}
        disabled={isSubmitting}
        label={isSubmitting ? "Submitting..." : mode === "sign-in" ? "Sign in" : "Sign up"}
      />

      <Pressable onPress={() => setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"))}>
        <Text style={styles.link}>{mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}</Text>
      </Pressable>

      <Link href="/forgot-password" asChild>
        <Pressable>
          <Text style={styles.link}>Forgot your password?</Text>
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
    color: neoColors.muted
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
    backgroundColor: neoColors.authPrimary,
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
    color: neoColors.successText,
    textAlign: "center"
  },
  link: {
    color: neoColors.primary
  }
});
