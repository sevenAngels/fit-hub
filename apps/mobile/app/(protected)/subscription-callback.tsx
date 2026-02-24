import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { subscriptionQueryKeys, useReportCheckoutReturnMutation } from "@/features/subscription/queries";

function isSubscriptionReturnUrl(url: string | null) {
  if (!url) {
    return false;
  }

  if (!url.includes("/subscription-callback") && !url.includes("/subscription")) {
    return false;
  }

  return (
    url.includes("status=") ||
    url.includes("result=") ||
    url.includes("checkout_status=") ||
    url.includes("canceled=") ||
    url.includes("error=") ||
    url.includes("success=true") ||
    url.includes("success=")
  );
}

export default function SubscriptionCallbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reportMutation = useReportCheckoutReturnMutation();
  const [statusMessage, setStatusMessage] = useState("Completing checkout return");
  const routeHandledFor = useMemo(() => new Set<string>(), []);

  useEffect(() => {
    const refreshSubscription = async () => {
      await queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status() });
    };

    const handleReturn = async (url: string | null) => {
      if (!url || !isSubscriptionReturnUrl(url) || routeHandledFor.has(url)) {
        return;
      }

      routeHandledFor.add(url);
      const urlValue = url;

      try {
        const result = await reportMutation.mutateAsync(urlValue);

        if (result.status === "success") {
          setStatusMessage("Checkout completed. Returning to profile");
        } else if (result.status === "canceled") {
          setStatusMessage("Checkout was canceled. You can try again from profile.");
        } else if (result.status === "failed") {
          setStatusMessage(result.errorMessage ? `Checkout failed: ${result.errorMessage}` : "Checkout failed. Try again.");
        } else {
          setStatusMessage("Checkout return received. Check subscription status in profile.");
        }
      } catch (error) {
        const fallbackMessage =
          error instanceof Error ? error.message : "Could not report checkout result. Please retry from profile.";
        setStatusMessage(fallbackMessage);
      } finally {
        await refreshSubscription();
      }
    };

    const processInitialUrl = () => {
      void Linking.getInitialURL().then((initialUrl) => {
        void handleReturn(initialUrl);
      });
    };

    processInitialUrl();

    const listener = Linking.addEventListener("url", ({ url }) => {
      void handleReturn(url);
    });

    return () => {
      listener.remove();
    };
  }, [queryClient, reportMutation, routeHandledFor]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2f6fa8" />
      <Text style={styles.title}>Subscription Checkout</Text>
      <Text style={styles.message}>{statusMessage}</Text>
      <Pressable style={styles.button} onPress={() => router.replace("/(protected)/profile")}>
        <Text style={styles.buttonLabel}>Back to profile</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(protected)")}>
        <Text style={styles.secondaryLabel}>Go to dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef4f8"
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#243a56"
  },
  message: {
    color: "#4f5f76",
    textAlign: "center"
  },
  button: {
    backgroundColor: "#2f6fa8",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8
  },
  buttonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#7ca9d1",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  secondaryLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
