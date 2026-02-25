import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { queryClient } from "@/infrastructure/query/client";
import { queryPersister } from "@/infrastructure/query/persistor";
import {
  initializeTelemetry,
  markStartupReady,
  markStartupStarted,
  trackTelemetryEvent,
  trackHealthTelemetrySnapshot
} from "@/infrastructure/telemetry/client";
import { healthFlags } from "@/infrastructure/config/env";

function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const healthSyncScheduledRef = useRef(false);

  useEffect(() => {
    if (!isLoading) {
      markStartupReady(isAuthenticated ? "authenticated-route-ready" : "auth-route-ready");
      trackHealthTelemetrySnapshot("startup-ready");
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!healthFlags.enabled) {
      return;
    }

    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      healthSyncScheduledRef.current = false;
      return;
    }

    if (healthSyncScheduledRef.current) {
      return;
    }

    healthSyncScheduledRef.current = true;
    const scheduledAtMs = Date.now();

    trackTelemetryEvent("health.sync.startup.scheduled", {
      trigger: "startup_post_auth",
      delay_ms: 700
    });

    const timer = setTimeout(() => {
      void import("@/features/health/sync-engine")
        .then(({ runDeferredHealthSync }) => runDeferredHealthSync("startup_post_auth"))
        .then((result) => {
          trackTelemetryEvent("health.sync.startup.result", {
            trigger: "startup_post_auth",
            status: result.status,
            reason: result.reason,
            provider: result.provider,
            row_count: result.rowCount,
            elapsed_since_schedule_ms: Date.now() - scheduledAtMs
          });
        })
        .catch((error) => {
          trackTelemetryEvent("health.sync.startup.result", {
            trigger: "startup_post_auth",
            status: "failed",
            reason: error instanceof Error ? error.message : "unknown_error",
            elapsed_since_schedule_ms: Date.now() - scheduledAtMs
          });
        });
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthenticated, isLoading]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(protected)" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  initializeTelemetry();
  markStartupStarted();

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 24 * 60 * 60 * 1000
      }}
    >
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
