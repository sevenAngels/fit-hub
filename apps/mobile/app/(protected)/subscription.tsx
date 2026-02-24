import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useOpenSubscriptionCheckoutMutation, useSubscriptionStatus } from "@/features/subscription/queries";
import type { CheckoutIntent, SubscriptionStatus } from "@/features/subscription/service";

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function readSearchParam(param: string | string[] | undefined): string | null {
  if (Array.isArray(param)) {
    return param[0] ?? null;
  }

  return param ?? null;
}

function describeStatus(status: SubscriptionStatus | undefined): { title: string; note: string } {
  if (!status) {
    return {
      title: "Unavailable",
      note: "Subscription status is currently unavailable."
    };
  }

  if (status.state === "active") {
    return {
      title: "Premium active",
      note: "Premium features are enabled for your account."
    };
  }

  if (status.state === "cancel_scheduled") {
    return {
      title: "Cancellation scheduled",
      note: "Premium remains available until the current billing period ends."
    };
  }

  if (status.state === "expired") {
    return {
      title: "Expired",
      note: "Premium access has ended. Re-open checkout to subscribe again."
    };
  }

  return {
    title: "Inactive",
    note: "Premium is not active for this account."
  };
}

export default function SubscriptionPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string | string[]; reason?: string | string[]; intent?: string | string[] }>();

  const statusQuery = useSubscriptionStatus();
  const checkoutMutation = useOpenSubscriptionCheckoutMutation();

  const [flowMessage, setFlowMessage] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [lastReturnUrl, setLastReturnUrl] = useState<string | null>(null);

  const checkoutState = readSearchParam(params.checkout);
  const checkoutReason = readSearchParam(params.reason);

  useEffect(() => {
    if (checkoutState === "success") {
      setFlowError(null);
      setFlowMessage("Checkout completed. Refresh status to sync latest subscription state.");
      return;
    }

    if (checkoutState === "cancel") {
      setFlowMessage(null);
      setFlowError("Checkout was canceled. You can retry web checkout anytime.");
      return;
    }

    if (checkoutState === "return") {
      setFlowError(null);
      setFlowMessage("Returned from web checkout. Tap refresh status to update the app.");
      return;
    }

    if (checkoutReason) {
      setFlowError(checkoutReason);
    }
  }, [checkoutReason, checkoutState]);

  const statusDescriptor = useMemo(() => describeStatus(statusQuery.data), [statusQuery.data]);

  const openWebCheckout = async (intent: CheckoutIntent) => {
    setFlowError(null);
    setFlowMessage(null);

    try {
      const launch = await checkoutMutation.mutateAsync(intent);
      setLastReturnUrl(launch.returnUrl);
      setFlowMessage("Web checkout opened. Return to the app and refresh subscription status.");
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "Failed to open web checkout.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Subscription</Text>
      <Text style={styles.subtitle}>Check your current plan and continue payment on secure web checkout.</Text>

      <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(protected)")}>
        <Text style={styles.secondaryLabel}>Back to dashboard</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current status</Text>

        {statusQuery.isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2f6fa8" />
            <Text style={styles.noteText}>Loading subscription...</Text>
          </View>
        ) : null}

        {statusQuery.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{statusQuery.error.message}</Text>
            <Pressable style={styles.retryButton} onPress={() => void statusQuery.refetch()}>
              <Text style={styles.retryLabel}>Retry load</Text>
            </Pressable>
          </View>
        ) : null}

        {!statusQuery.isLoading && !statusQuery.error ? (
          <>
            <Text style={styles.statusTitle}>{statusDescriptor.title}</Text>
            <Text style={styles.noteText}>{statusDescriptor.note}</Text>
            <Text style={styles.metaText}>Plan: {statusQuery.data?.plan ?? "free"}</Text>
            <Text style={styles.metaText}>State: {statusQuery.data?.status ?? "inactive"}</Text>
            <Text style={styles.metaText}>Auto renew: {statusQuery.data?.autoRenew ? "on" : "off"}</Text>
            <Text style={styles.metaText}>Next billing: {formatDate(statusQuery.data?.nextBillingDate ?? null)}</Text>
            <Text style={styles.metaText}>Current period end: {formatDate(statusQuery.data?.currentPeriodEnd ?? null)}</Text>
            <Text style={styles.metaText}>
              Price: {typeof statusQuery.data?.priceMonthly === "number" ? `${statusQuery.data.priceMonthly} KRW/month` : "-"}
            </Text>
            <Text style={styles.metaText}>Payment method: {statusQuery.data?.cardLabel ?? "-"}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Web checkout fallback</Text>
        <Text style={styles.noteText}>
          For MVP, subscription payment and management continue on the web billing page. The app only displays subscription state.
        </Text>
        <Text style={styles.noteText}>
          Before leaving the app, you will open a secure web page. After checkout, return to this screen and refresh status.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => void openWebCheckout("upgrade")}
          disabled={checkoutMutation.isPending}
        >
          <Text style={styles.primaryLabel}>{checkoutMutation.isPending ? "Opening..." : "Open web checkout"}</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButtonInline}
          onPress={() => void openWebCheckout("manage")}
          disabled={checkoutMutation.isPending}
        >
          <Text style={styles.secondaryInlineLabel}>Manage billing on web</Text>
        </Pressable>

        <Pressable style={styles.refreshButton} onPress={() => void statusQuery.refetch()} disabled={statusQuery.isFetching}>
          <Text style={styles.refreshLabel}>{statusQuery.isFetching ? "Refreshing..." : "Refresh status"}</Text>
        </Pressable>

        {flowMessage ? <Text style={styles.successText}>{flowMessage}</Text> : null}
        {flowError ? <Text style={styles.errorText}>{flowError}</Text> : null}
        {lastReturnUrl ? <Text style={styles.traceText}>Tracked return path: {lastReturnUrl}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef4f8"
  },
  content: {
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#243a56"
  },
  subtitle: {
    color: "#4f5f76"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ccdae8",
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#2c4f6f"
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#23486a"
  },
  noteText: {
    color: "#4f5f76"
  },
  metaText: {
    color: "#39536e"
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#f1b0ba",
    borderRadius: 10,
    backgroundColor: "#fff2f4",
    padding: 10,
    gap: 8
  },
  errorText: {
    color: "#b00020"
  },
  successText: {
    color: "#276749"
  },
  traceText: {
    color: "#5b6f84",
    fontSize: 12
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#f4d3d8",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  retryLabel: {
    color: "#8b0015",
    fontWeight: "700"
  },
  primaryButton: {
    backgroundColor: "#2f6fa8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#d9e7f3",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  secondaryLabel: {
    color: "#23486a",
    fontWeight: "700"
  },
  secondaryButtonInline: {
    backgroundColor: "#d9e7f3",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryInlineLabel: {
    color: "#23486a",
    fontWeight: "700"
  },
  refreshButton: {
    backgroundColor: "#7ca9d1",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  refreshLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
