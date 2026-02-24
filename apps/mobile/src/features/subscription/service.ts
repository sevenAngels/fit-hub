import * as Linking from "expo-linking";

import type { ApiClientError } from "@/infrastructure/api/client";
import { mobileApiClient } from "@/infrastructure/api/client";
import { appEnv } from "@/infrastructure/config/env";
import { captureHandledError, trackTelemetryEvent } from "@/infrastructure/telemetry/client";

type SubscriptionApiRow = {
  id?: string | null;
  plan?: string | null;
  status?: string | null;
  auto_renew?: boolean | null;
  current_period_end?: string | null;
  next_billing_date?: string | null;
  price_monthly?: number | null;
  card_company?: string | null;
  card_number?: string | null;
};

type SubscriptionApiResponse = {
  success: boolean;
  data: SubscriptionApiRow | null;
  error?: string;
};

export type SubscriptionState = "inactive" | "active" | "cancel_scheduled" | "expired";

export type SubscriptionStatus = {
  state: SubscriptionState;
  plan: string;
  status: string;
  isPremium: boolean;
  isActive: boolean;
  autoRenew: boolean;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  priceMonthly: number | null;
  cardLabel: string | null;
};

export type CheckoutIntent = "upgrade" | "manage" | "retry";

export type CheckoutFallbackLaunch = {
  checkoutUrl: string;
  returnUrl: string;
  intent: CheckoutIntent;
};

export type CheckoutResultStatus = "success" | "canceled" | "failed" | "unknown";

export type CheckoutResult = {
  status: CheckoutResultStatus;
  errorMessage?: string | null;
};

function toError(message: string, status = 500): ApiClientError {
  return {
    status,
    code: "unknown",
    message
  };
}

function isApiClientError(value: unknown): value is ApiClientError {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.status === "number" &&
    typeof record.code === "string" &&
    typeof record.message === "string"
  );
}

function mapApiError(value: unknown, fallbackMessage: string): ApiClientError {
  if (isApiClientError(value)) {
    return value;
  }

  if (value instanceof Error) {
    return toError(value.message, 500);
  }

  return toError(fallbackMessage, 500);
}

function deriveWebBaseUrl(): string {
  if (appEnv.EXPO_PUBLIC_WEB_BASE_URL) {
    return appEnv.EXPO_PUBLIC_WEB_BASE_URL;
  }

  const apiUrl = new URL(appEnv.EXPO_PUBLIC_API_BASE_URL);
  return `${apiUrl.protocol}//${apiUrl.host}`;
}

export async function reportCheckoutReturn(url: string): Promise<CheckoutResult> {
  try {
    const parsedUrl = new URL(url);
    const query = parsedUrl.searchParams;

    const statusToken =
      query.get("status") ||
      query.get("result") ||
      query.get("checkout_status") ||
      query.get("state") ||
      (query.get("success") === "true" ? "success" : null);

    const errorMessage =
      query.get("message") ||
      query.get("error") ||
      query.get("reason") ||
      query.get("checkout_error") ||
      null;

    const isCanceled =
      query.get("canceled") === "true" ||
      query.get("cancel") === "true" ||
      (statusToken ? ["cancel", "canceled", "cancelled", "abort", "aborted", "dismissed"].includes(statusToken.toLowerCase()) : false);

    if (statusToken) {
      const normalized = statusToken.toLowerCase();

      if (normalized.includes("success") || normalized === "ok" || normalized === "completed") {
        return { status: "success" };
      }

      if (isCanceled || normalized.includes("cancel") || normalized === "false") {
        return { status: "canceled" };
      }

      if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("declin")) {
        return { status: "failed", errorMessage };
      }
    }

    if (errorMessage) {
      return { status: "failed", errorMessage };
    }

    return { status: "unknown", errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid checkout callback URL";
    return { status: "failed", errorMessage: message };
  }
}

function normalizeSubscriptionStatus(row: SubscriptionApiRow | null): SubscriptionStatus {
  const plan = row?.plan ?? "free";
  const status = row?.status ?? "inactive";
  const autoRenew = row?.auto_renew ?? false;
  const currentPeriodEnd = row?.current_period_end ?? null;
  const nextBillingDate = row?.next_billing_date ?? null;
  const isPremium = plan === "premium";

  const hasPeriodEnded = Boolean(currentPeriodEnd && new Date(currentPeriodEnd) <= new Date());
  const isExpired = status === "expired" || (isPremium && status === "active" && autoRenew === false && hasPeriodEnded);
  const isCancelScheduled = isPremium && status === "active" && autoRenew === false && !hasPeriodEnded;
  const isActive = isPremium && status === "active" && !isExpired;

  let state: SubscriptionState = "inactive";
  if (isExpired) {
    state = "expired";
  } else if (isCancelScheduled) {
    state = "cancel_scheduled";
  } else if (isActive) {
    state = "active";
  }

  const cardLabel = row?.card_company && row?.card_number ? `${row.card_company} ${row.card_number}` : null;

  return {
    state,
    plan,
    status,
    isPremium,
    isActive,
    autoRenew,
    currentPeriodEnd,
    nextBillingDate,
    priceMonthly: row?.price_monthly ?? null,
    cardLabel
  };
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const response = await mobileApiClient.subscriptionStatus<SubscriptionApiResponse>();

    if (!response.success) {
      throw toError(response.error ?? "Failed to load subscription status.", 500);
    }

    return normalizeSubscriptionStatus(response.data);
  } catch (error) {
    const mapped = mapApiError(error, "Failed to load subscription status.");
    captureHandledError("subscription.status", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}

function buildCheckoutFallbackLaunch(intent: CheckoutIntent): CheckoutFallbackLaunch {
  const returnUrl = Linking.createURL("/(protected)/subscription", {
    queryParams: {
      checkout: "return",
      intent
    }
  });

  const checkoutUrl = new URL("/settings/billing", `${deriveWebBaseUrl().replace(/\/$/, "")}/`);
  checkoutUrl.searchParams.set("source", "mobile");
  checkoutUrl.searchParams.set("entry", "app_subscription");
  checkoutUrl.searchParams.set("intent", intent);
  checkoutUrl.searchParams.set("return_to", returnUrl);

  return {
    checkoutUrl: checkoutUrl.toString(),
    returnUrl,
    intent
  };
}

export async function openSubscriptionCheckoutFallback(intent: CheckoutIntent = "upgrade"): Promise<CheckoutFallbackLaunch> {
  const launch = buildCheckoutFallbackLaunch(intent);

  try {
    const supported = await Linking.canOpenURL(launch.checkoutUrl);
    if (!supported) {
      throw toError("Web checkout URL is not supported on this device.", 400);
    }

    await Linking.openURL(launch.checkoutUrl);

    trackTelemetryEvent("subscription.checkout.fallback_opened", {
      intent,
      checkout_url: launch.checkoutUrl,
      return_url: launch.returnUrl
    });

    return launch;
  } catch (error) {
    const mapped = mapApiError(error, "Failed to open web checkout.");
    captureHandledError("subscription.checkout", new Error(mapped.message), {
      intent,
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}
