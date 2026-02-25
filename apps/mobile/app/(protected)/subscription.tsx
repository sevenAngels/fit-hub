import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { useOpenSubscriptionCheckoutMutation, useSubscriptionStatus } from "@/features/subscription/queries";
import type { CheckoutIntent, SubscriptionStatus } from "@/features/subscription/service";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoCard } from "@/shared/ui/neo-primitives";

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

      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.replace("/(protected)")} label="Back to dashboard" />

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Current status</Text>

        {statusQuery.isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={neoColors.primary} />
            <Text style={styles.noteText}>Loading subscription...</Text>
          </View>
        ) : null}

        {statusQuery.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{statusQuery.error.message}</Text>
            <NeoButton variant="danger" style={styles.retryButton} labelStyle={styles.retryLabel} onPress={() => void statusQuery.refetch()} label="Retry load" />
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
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Web checkout fallback</Text>
        <Text style={styles.noteText}>
          For MVP, subscription payment and management continue on the web billing page. The app only displays subscription state.
        </Text>
        <Text style={styles.noteText}>
          Before leaving the app, you will open a secure web page. After checkout, return to this screen and refresh status.
        </Text>

        <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel}
          onPress={() => void openWebCheckout("upgrade")}
          disabled={checkoutMutation.isPending} label={checkoutMutation.isPending ? "Opening..." : "Open web checkout"} />

        <NeoButton variant="secondary" style={styles.secondaryButtonInline} labelStyle={styles.secondaryInlineLabel}
          onPress={() => void openWebCheckout("manage")}
          disabled={checkoutMutation.isPending} label="Manage billing on web" />

        <NeoButton variant="accent" style={styles.refreshButton} labelStyle={styles.refreshLabel} onPress={() => void statusQuery.refetch()} disabled={statusQuery.isFetching} label={statusQuery.isFetching ? "Refreshing..." : "Refresh status"} />

        {flowMessage ? <Text style={styles.successText}>{flowMessage}</Text> : null}
        {flowError ? <Text style={styles.errorText}>{flowError}</Text> : null}
        {lastReturnUrl ? <Text style={styles.traceText}>Tracked return path: {lastReturnUrl}</Text> : null}
      </NeoCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neoColors.background
  },
  content: {
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: neoColors.ink
  },
  subtitle: {
    color: neoColors.muted
  },
  card: {
    backgroundColor: neoColors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    fontWeight: "700",
    color: neoColors.ink
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: neoColors.ink
  },
  noteText: {
    color: neoColors.muted
  },
  metaText: {
    color: neoColors.muted
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  errorCard: {
    borderWidth: 1,
    borderColor: neoColors.dangerBorder,
    borderRadius: 10,
    backgroundColor: neoColors.dangerPale,
    padding: 10,
    gap: 8
  },
  errorText: {
    color: neoColors.dangerText
  },
  successText: {
    color: neoColors.successText
  },
  traceText: {
    color: neoColors.mutedStrong,
    fontSize: 12
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: neoColors.dangerSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  retryLabel: {
    color: neoColors.dangerStrong,
    fontWeight: "700"
  },
  primaryButton: {
    backgroundColor: neoColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryLabel: {
    color: neoColors.white,
    fontWeight: "700"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: neoColors.secondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  secondaryLabel: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  secondaryButtonInline: {
    backgroundColor: neoColors.secondary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryInlineLabel: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  refreshButton: {
    backgroundColor: neoColors.secondary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  refreshLabel: {
    color: neoColors.white,
    fontWeight: "700"
  }
});
