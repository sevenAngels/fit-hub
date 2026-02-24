import { useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { applySessionFromDeepLink } from "@/features/auth/service";

function isAuthCallbackUrl(url: string | null) {
  if (!url) {
    return false;
  }

  return url.includes("/callback") && (url.includes("access_token") || url.includes("refresh_token") || url.includes("code=") || url.includes("error="));
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("Waiting for link callback");
  const routeHandledFor = useMemo(() => new Set<string>(), []);

  useEffect(() => {
    const handleCallback = async (url: string | null) => {
      if (!url || !isAuthCallbackUrl(url) || routeHandledFor.has(url)) {
        return;
      }

      routeHandledFor.add(url);
      const result = await applySessionFromDeepLink(url);

      if (!result.ok) {
        setStatusMessage(result.errorMessage ?? "Authentication failed");
        return;
      }

      if (result.redirectTo === "reset-password") {
        router.replace("/reset-password");
        return;
      }

      if (result.redirectTo === "onboarding") {
        router.replace("/(protected)/onboarding");
        return;
      }

      router.replace("/(protected)");
    };

    const processInitialUrl = () => {
      void Linking.getInitialURL().then((initialUrl) => {
        void handleCallback(initialUrl);
      });
    };

    processInitialUrl();

    const listener = Linking.addEventListener("url", ({ url }) => {
      void handleCallback(url);
    });

    return () => {
      listener.remove();
    };
  }, [routeHandledFor, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.message}>{statusMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8f6f2"
  },
  message: {
    marginTop: 16,
    color: "#243a56",
    textAlign: "center"
  }
});
