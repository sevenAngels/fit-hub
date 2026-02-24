import { useMemo } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  useAndroidHealthConnectSnapshotQuery,
  useIOSHealthPermissionSnapshotQuery,
  useOpenAndroidHealthConnectInstallProviderMutation,
  useOpenAndroidHealthConnectSettingsMutation,
  useOpenIOSHealthSettingsMutation,
  useRequestAndroidHealthConnectPermissionMutation,
  useRequestIOSHealthPermissionMutation
} from "@/features/health/queries";
import type { AndroidHealthConnectSnapshot, IOSHealthPermissionSnapshot } from "@/features/health/service";
import { healthFlags } from "@/infrastructure/config/env";

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function describeIOSState(snapshot: IOSHealthPermissionSnapshot | undefined): { title: string; note: string } {
  if (!snapshot) {
    return {
      title: "Status unavailable",
      note: "Health permission status is unavailable."
    };
  }

  if (snapshot.state === "granted") {
    return {
      title: "Connected",
      note: "Read-only access for Steps and Active Calories is enabled."
    };
  }

  if (snapshot.state === "revoked") {
    return {
      title: "Permission revoked",
      note: "Access was previously granted but is now removed. Reconnect in iOS Settings."
    };
  }

  if (snapshot.state === "denied") {
    return {
      title: "Permission denied",
      note: "HealthKit access is denied. Use Settings to allow read access and retry."
    };
  }

  if (snapshot.state === "notDetermined") {
    return {
      title: "Ready to connect",
      note: "Before requesting permission, review why we only read steps and active calories."
    };
  }

  return {
    title: "Unavailable",
    note: "Health data is unavailable for this device/profile."
  };
}

function describeAndroidState(snapshot: AndroidHealthConnectSnapshot | undefined): { title: string; note: string } {
  if (!snapshot) {
    return {
      title: "Status unavailable",
      note: "Health Connect provider status is unavailable."
    };
  }

  if (snapshot.providerAvailability === "update_required") {
    return {
      title: "Update required",
      note: "Health Connect provider update is required before permission and sync controls can continue."
    };
  }

  if (snapshot.providerAvailability === "unavailable") {
    return {
      title: "Provider unavailable",
      note: "Health Connect provider is missing on this device. Install provider and retry."
    };
  }

  if (snapshot.permissionState === "granted" && snapshot.readCheckState === "ok") {
    return {
      title: "Connected",
      note: "Health Connect provider and read permissions are ready for sync."
    };
  }

  if (snapshot.permissionState === "denied") {
    return {
      title: "Permission denied",
      note: "Read permissions were denied. Reopen permission flow or provider settings to recover."
    };
  }

  if (snapshot.permissionState === "notRequested") {
    return {
      title: "Ready to connect",
      note: "Request read-only permissions for steps and active calories to continue."
    };
  }

  if (snapshot.readCheckState === "token_expired") {
    return {
      title: "Token expired",
      note: "Provider token expired. Reconnect provider or refresh permissions before sync controls."
    };
  }

  if (snapshot.readCheckState === "provider_disabled") {
    return {
      title: "Provider disabled",
      note: "Provider access is currently disabled. Open provider settings and retry."
    };
  }

  return {
    title: "Manual fallback",
    note: "Health controls remain non-blocking. Core app navigation stays available."
  };
}

export default function HealthPage() {
  const router = useRouter();

  const isIOSFlowEnabled = Platform.OS === "ios" && healthFlags.enabled && healthFlags.ios;
  const isAndroidFlowEnabled = Platform.OS === "android" && healthFlags.enabled && healthFlags.android;

  const iosPermissionQuery = useIOSHealthPermissionSnapshotQuery(isIOSFlowEnabled);
  const iosRequestMutation = useRequestIOSHealthPermissionMutation();
  const iosOpenSettingsMutation = useOpenIOSHealthSettingsMutation();

  const androidSnapshotQuery = useAndroidHealthConnectSnapshotQuery(isAndroidFlowEnabled);
  const androidRequestMutation = useRequestAndroidHealthConnectPermissionMutation();
  const androidOpenSettingsMutation = useOpenAndroidHealthConnectSettingsMutation();
  const androidOpenInstallMutation = useOpenAndroidHealthConnectInstallProviderMutation();

  const iosDescriptor = useMemo(() => describeIOSState(iosPermissionQuery.data), [iosPermissionQuery.data]);
  const androidDescriptor = useMemo(() => describeAndroidState(androidSnapshotQuery.data), [androidSnapshotQuery.data]);

  const showIOSRationale = iosPermissionQuery.data?.state === "notDetermined";
  const showIOSRecovery = iosPermissionQuery.data?.state === "denied" || iosPermissionQuery.data?.state === "revoked";

  const showAndroidInstallGuidance =
    androidSnapshotQuery.data?.providerAvailability === "unavailable" ||
    androidSnapshotQuery.data?.providerAvailability === "update_required";
  const showAndroidPermissionRationale =
    androidSnapshotQuery.data?.providerAvailability === "available" && androidSnapshotQuery.data?.permissionState === "notRequested";
  const showAndroidPermissionRecovery = androidSnapshotQuery.data?.permissionState === "denied";
  const showAndroidReadError =
    androidSnapshotQuery.data?.permissionState === "granted" &&
    androidSnapshotQuery.data.readCheckState !== "ok" &&
    androidSnapshotQuery.data.readCheckState !== "not_checked";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Health Connect</Text>
      <Text style={styles.subtitle}>Health checks run on this screen only, so startup/auth/dashboard remain non-blocking.</Text>

      <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(protected)")}>
        <Text style={styles.secondaryLabel}>Back to dashboard</Text>
      </Pressable>

      {!healthFlags.enabled ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Feature disabled</Text>
          <Text style={styles.noteText}>Health feature flags are disabled for this build. Core flows remain fully available.</Text>
        </View>
      ) : null}

      {isIOSFlowEnabled ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>iOS HealthKit</Text>

          {iosPermissionQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2f6fa8" />
              <Text style={styles.noteText}>Loading permission status...</Text>
            </View>
          ) : null}

          {iosPermissionQuery.error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{iosPermissionQuery.error.message}</Text>
              <Pressable style={styles.retryButton} onPress={() => void iosPermissionQuery.refetch()}>
                <Text style={styles.retryLabel}>Retry status check</Text>
              </Pressable>
            </View>
          ) : null}

          {!iosPermissionQuery.isLoading && !iosPermissionQuery.error ? (
            <>
              <Text style={styles.statusTitle}>{iosDescriptor.title}</Text>
              <Text style={styles.noteText}>{iosDescriptor.note}</Text>
              <Text style={styles.metaText}>Sync state: {iosPermissionQuery.data?.syncState ?? "idle"}</Text>
              <Text style={styles.metaText}>Checked at: {iosPermissionQuery.data ? formatDate(iosPermissionQuery.data.checkedAt) : "-"}</Text>

              <Text style={styles.sectionTitle}>Read scopes (MVP)</Text>
              <Text style={styles.metaText}>- HKQuantityTypeIdentifierStepCount</Text>
              <Text style={styles.metaText}>- HKQuantityTypeIdentifierActiveEnergyBurned</Text>

              {showIOSRationale ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>Before connecting</Text>
                  <Text style={styles.noteText}>The app reads daily steps and active calories only. It does not write data to HealthKit.</Text>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => void iosRequestMutation.mutateAsync().then(() => iosPermissionQuery.refetch())}
                    disabled={iosRequestMutation.isPending}
                  >
                    <Text style={styles.primaryLabel}>{iosRequestMutation.isPending ? "Requesting..." : "Connect HealthKit"}</Text>
                  </Pressable>
                </View>
              ) : null}

              {showIOSRecovery ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>Recovery</Text>
                  <Text style={styles.noteText}>Open iOS Settings to re-enable Health permission, then come back and refresh status.</Text>
                  <Pressable
                    style={styles.secondaryButtonInline}
                    onPress={() => void iosOpenSettingsMutation.mutateAsync()}
                    disabled={iosOpenSettingsMutation.isPending}
                  >
                    <Text style={styles.secondaryInlineLabel}>{iosOpenSettingsMutation.isPending ? "Opening..." : "Open iOS Settings"}</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable style={styles.refreshButton} onPress={() => void iosPermissionQuery.refetch()} disabled={iosPermissionQuery.isFetching}>
                <Text style={styles.refreshLabel}>{iosPermissionQuery.isFetching ? "Refreshing..." : "Refresh status"}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {isAndroidFlowEnabled ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Android Health Connect</Text>

          {androidSnapshotQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2f6fa8" />
              <Text style={styles.noteText}>Loading provider status...</Text>
            </View>
          ) : null}

          {androidSnapshotQuery.error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{androidSnapshotQuery.error.message}</Text>
              <Pressable style={styles.retryButton} onPress={() => void androidSnapshotQuery.refetch()}>
                <Text style={styles.retryLabel}>Retry provider check</Text>
              </Pressable>
            </View>
          ) : null}

          {!androidSnapshotQuery.isLoading && !androidSnapshotQuery.error ? (
            <>
              <Text style={styles.statusTitle}>{androidDescriptor.title}</Text>
              <Text style={styles.noteText}>{androidDescriptor.note}</Text>
              <Text style={styles.metaText}>Provider availability: {androidSnapshotQuery.data?.providerAvailability ?? "-"}</Text>
              <Text style={styles.metaText}>Provider version: {androidSnapshotQuery.data?.providerVersion ?? "-"}</Text>
              <Text style={styles.metaText}>Permission state: {androidSnapshotQuery.data?.permissionState ?? "notRequested"}</Text>
              <Text style={styles.metaText}>Sync state: {androidSnapshotQuery.data?.syncState ?? "idle"}</Text>
              <Text style={styles.metaText}>Read check: {androidSnapshotQuery.data?.readCheckState ?? "not_checked"}</Text>
              <Text style={styles.metaText}>Checked at: {androidSnapshotQuery.data ? formatDate(androidSnapshotQuery.data.checkedAt) : "-"}</Text>

              <Text style={styles.sectionTitle}>Read permission matrix (MVP)</Text>
              <Text style={styles.metaText}>- read:Steps</Text>
              <Text style={styles.metaText}>- read:ActiveCaloriesBurned</Text>

              {showAndroidInstallGuidance ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>Install or update provider</Text>
                  <Text style={styles.noteText}>Provider missing/outdated branch. Open install path first, then refresh provider status.</Text>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => void androidOpenInstallMutation.mutateAsync()}
                    disabled={androidOpenInstallMutation.isPending}
                  >
                    <Text style={styles.primaryLabel}>
                      {androidOpenInstallMutation.isPending ? "Opening..." : "Install or update Health Connect"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {showAndroidPermissionRationale ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>Before connecting</Text>
                  <Text style={styles.noteText}>The app requests read-only access to Steps and Active Calories. Core app remains usable even if denied.</Text>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => void androidRequestMutation.mutateAsync().then(() => androidSnapshotQuery.refetch())}
                    disabled={androidRequestMutation.isPending}
                  >
                    <Text style={styles.primaryLabel}>{androidRequestMutation.isPending ? "Requesting..." : "Request Android permissions"}</Text>
                  </Pressable>
                </View>
              ) : null}

              {showAndroidPermissionRecovery ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>Permission recovery</Text>
                  <Text style={styles.noteText}>Open provider settings or retry permission request. Core navigation remains non-blocking.</Text>
                  <Pressable
                    style={styles.secondaryButtonInline}
                    onPress={() => void androidOpenSettingsMutation.mutateAsync()}
                    disabled={androidOpenSettingsMutation.isPending}
                  >
                    <Text style={styles.secondaryInlineLabel}>
                      {androidOpenSettingsMutation.isPending ? "Opening..." : "Open Health Connect settings"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButtonInline}
                    onPress={() => void androidRequestMutation.mutateAsync().then(() => androidSnapshotQuery.refetch())}
                    disabled={androidRequestMutation.isPending}
                  >
                    <Text style={styles.secondaryInlineLabel}>{androidRequestMutation.isPending ? "Requesting..." : "Retry permission request"}</Text>
                  </Pressable>
                </View>
              ) : null}

              {showAndroidReadError ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>Read precheck blocked</Text>
                  <Text style={styles.errorText}>{androidSnapshotQuery.data?.readErrorMessage ?? "Unknown read precheck error"}</Text>
                  <Text style={styles.noteText}>Sync controls stay blocked until provider/permission/read precheck is healthy.</Text>
                </View>
              ) : null}

              <Pressable style={styles.refreshButton} onPress={() => void androidSnapshotQuery.refetch()} disabled={androidSnapshotQuery.isFetching}>
                <Text style={styles.refreshLabel}>{androidSnapshotQuery.isFetching ? "Refreshing..." : "Refresh provider status"}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {Platform.OS !== "ios" && Platform.OS !== "android" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Unsupported platform</Text>
          <Text style={styles.noteText}>Health integration is supported only on iOS and Android.</Text>
        </View>
      ) : null}
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
  noticeCard: {
    borderWidth: 1,
    borderColor: "#ccdae8",
    borderRadius: 10,
    backgroundColor: "#f7fbff",
    padding: 10,
    gap: 8
  },
  noticeTitle: {
    fontWeight: "700",
    color: "#295175"
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
