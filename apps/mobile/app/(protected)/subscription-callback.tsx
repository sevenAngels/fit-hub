import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { subscriptionQueryKeys, useReportCheckoutReturnMutation } from "@/features/subscription/queries";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton } from "@/shared/ui/neo-primitives";

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
      <ActivityIndicator size="large" color={neoColors.primary} />
      <Text style={styles.title}>Subscription Checkout</Text>
      <Text style={styles.message}>{statusMessage}</Text>
      <NeoButton
        variant="primary"
        style={styles.button}
        labelStyle={styles.buttonLabel}
        onPress={() => router.replace("/(protected)/profile")}
        label="Back to profile"
      />
      <NeoButton
        variant="accent"
        style={styles.secondaryButton}
        labelStyle={styles.secondaryLabel}
        onPress={() => router.replace("/(protected)")}
        label="Go to dashboard"
      />
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
    backgroundColor: neoColors.background
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: neoColors.ink
  },
  message: {
    color: neoColors.muted,
    textAlign: "center"
  },
  button: {
    backgroundColor: neoColors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8
  },
  buttonLabel: {
    color: neoColors.white,
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: neoColors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  secondaryLabel: {
    color: neoColors.white,
    fontWeight: "700"
  }
});
