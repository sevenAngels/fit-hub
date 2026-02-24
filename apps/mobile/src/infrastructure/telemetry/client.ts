import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";

import { appEnv, healthFlags, telemetryConfig } from "@/infrastructure/config/env";

type TelemetryValue = string | number | boolean | null | undefined;
type TelemetryProps = Record<string, TelemetryValue>;

type ApiRequestMetric = {
  path: string;
  method: string;
  status: number;
  durationMs: number;
  attempts: number;
  ok: boolean;
  errorCode?: string;
};

type UploadMetric = {
  operation: string;
  durationMs: number;
  ok: boolean;
  errorCode?: string;
};

let telemetryInitialized = false;
let startupStartMs: number | null = null;
let startupTracked = false;

function sanitizeProperties(properties: TelemetryProps): Record<string, string | number | boolean | null> {
  const next: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "undefined") {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      next[key] = value;
    }
  }

  return next;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown telemetry error");
}

function posthogEnabled() {
  return telemetryConfig.analyticsProvider === "posthog" && Boolean(telemetryConfig.posthogApiKey);
}

function posthogCapture(event: string, properties: Record<string, string | number | boolean | null>): void {
  if (!posthogEnabled()) {
    return;
  }

  const payload = {
    api_key: telemetryConfig.posthogApiKey,
    event,
    properties: {
      distinct_id: "mobile-anonymous",
      app_env: appEnv.EXPO_PUBLIC_APP_ENV,
      platform: Platform.OS,
      ...properties
    },
    timestamp: new Date().toISOString()
  };

  void fetch(`${telemetryConfig.posthogHost.replace(/\/$/, "")}/capture/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }).catch(() => undefined);
}

export function initializeTelemetry(): void {
  if (telemetryInitialized) {
    return;
  }

  telemetryInitialized = true;

  if (telemetryConfig.sentryDsn) {
    Sentry.init({
      dsn: telemetryConfig.sentryDsn,
      environment: appEnv.EXPO_PUBLIC_APP_ENV,
      enabled: true,
      tracesSampleRate: appEnv.EXPO_PUBLIC_APP_ENV === "prod" ? 0.1 : 1
    });
  }

  trackTelemetryEvent("telemetry.init", {
    sentry_enabled: Boolean(telemetryConfig.sentryDsn),
    analytics_provider: telemetryConfig.analyticsProvider
  });
}

export function markStartupStarted(): void {
  if (startupStartMs !== null) {
    return;
  }
  startupStartMs = Date.now();
}

export function markStartupReady(stage: string): void {
  if (startupTracked || startupStartMs === null) {
    return;
  }

  startupTracked = true;
  const durationMs = Date.now() - startupStartMs;
  trackTelemetryEvent("app.startup.ready", {
    stage,
    duration_ms: durationMs
  });
}

export function trackTelemetryEvent(event: string, props: TelemetryProps = {}): void {
  const properties = sanitizeProperties(props);

  Sentry.addBreadcrumb({
    category: "telemetry",
    message: event,
    level: "info",
    data: properties
  });

  posthogCapture(event, properties);
}

export function captureHandledError(scopeName: string, error: unknown, context: TelemetryProps = {}): void {
  const normalized = toError(error);

  Sentry.withScope((scope) => {
    scope.setTag("handled_scope", scopeName);
    for (const [key, value] of Object.entries(sanitizeProperties(context))) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(normalized);
  });

  trackTelemetryEvent("error.handled", {
    scope: scopeName,
    error_name: normalized.name,
    error_message: normalized.message,
    ...context
  });
}

export function trackApiRequestMetric(metric: ApiRequestMetric): void {
  trackTelemetryEvent("api.request", {
    path: metric.path,
    method: metric.method,
    status: metric.status,
    ok: metric.ok,
    duration_ms: metric.durationMs,
    attempts: metric.attempts,
    error_code: metric.errorCode
  });

  if (!metric.ok) {
    trackTelemetryEvent("api.error_rate.signal", {
      path: metric.path,
      method: metric.method,
      status: metric.status,
      error_code: metric.errorCode
    });
  }
}

export function trackUploadMetric(metric: UploadMetric): void {
  trackTelemetryEvent("upload.latency", {
    operation: metric.operation,
    duration_ms: metric.durationMs,
    ok: metric.ok,
    error_code: metric.errorCode
  });
}

export function trackHealthTelemetrySnapshot(reason: string): void {
  trackTelemetryEvent("health.telemetry.snapshot", {
    reason,
    health_enabled: healthFlags.enabled,
    health_ios_enabled: healthFlags.ios,
    health_android_enabled: healthFlags.android,
    provider_availability: healthFlags.enabled ? "unknown" : "disabled"
  });
}

export function trackHealthPermissionState(state: "granted" | "denied" | "revoked" | "unknown", provider: "healthkit" | "health_connect"): void {
  trackTelemetryEvent("health.permission.state", {
    state,
    provider
  });
}

export function trackHealthSyncMetric(metricName: string, value: number, unit: string): void {
  trackTelemetryEvent("health.sync.metric", {
    metric_name: metricName,
    metric_value: value,
    metric_unit: unit
  });
}
