import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthorizationRequestStatus,
  AuthorizationStatus,
  authorizationStatusFor,
  getRequestStatusForAuthorization,
  isHealthDataAvailableAsync,
  requestAuthorization,
  type ObjectTypeIdentifier
} from "@kingstinct/react-native-healthkit";
import {
  SdkAvailabilityStatus,
  getChanges,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  type Permission
} from "react-native-health-connect";
import { Linking, Platform } from "react-native";

import type { ApiClientError } from "@/infrastructure/api/client";
import { healthFlags } from "@/infrastructure/config/env";
import { captureHandledError, trackHealthPermissionState, trackTelemetryEvent } from "@/infrastructure/telemetry/client";

const IOS_HEALTH_READ_TYPES = [
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierActiveEnergyBurned"
] as const satisfies readonly ObjectTypeIdentifier[];

const ANDROID_HEALTH_READ_PERMISSIONS: Permission[] = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" }
];

const ANDROID_HEALTH_RECORD_TYPES = ["Steps", "ActiveCaloriesBurned"] as const;

const EVER_GRANTED_KEY = "healthkit.ios.ever-granted.v1";
const ANDROID_PERMISSION_REQUESTED_KEY = "healthconnect.android.permission-requested.v1";
const ANDROID_CHANGES_TOKEN_KEY = "healthconnect.android.changes-token.v1";

const ANDROID_PROVIDER_PACKAGE_NAME = "com.google.android.apps.healthdata";
const ANDROID_INSTALL_MARKET_URL = `market://details?id=${ANDROID_PROVIDER_PACKAGE_NAME}`;
const ANDROID_INSTALL_WEB_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PROVIDER_PACKAGE_NAME}`;

type IOSReadType = (typeof IOS_HEALTH_READ_TYPES)[number];

type AuthorizationByType = Record<IOSReadType, AuthorizationStatus>;

export type IOSHealthPermissionState = "notDetermined" | "denied" | "revoked" | "granted" | "unavailable";

export type IOSHealthSyncState = "idle" | "blocked" | "connected";

export type IOSHealthPermissionSnapshot = {
  state: IOSHealthPermissionState;
  syncState: IOSHealthSyncState;
  requestStatus: AuthorizationRequestStatus | null;
  authorizationByType: AuthorizationByType;
  available: boolean;
  checkedAt: string;
};

export type AndroidHealthProviderAvailability =
  | "available"
  | "update_required"
  | "unavailable"
  | "disabled"
  | "unsupported_platform";

export type AndroidHealthProviderVersion = "up_to_date" | "update_required" | "unknown";

export type AndroidHealthPermissionState = "notRequested" | "denied" | "granted";

export type AndroidHealthReadCheckState =
  | "not_checked"
  | "ok"
  | "permission_denied"
  | "provider_disabled"
  | "token_expired"
  | "unknown_error";

export type AndroidHealthSyncState = "idle" | "blocked" | "connected";

export type AndroidHealthConnectSnapshot = {
  providerAvailable: boolean;
  providerAvailability: AndroidHealthProviderAvailability;
  providerVersion: AndroidHealthProviderVersion;
  sdkStatus: number | null;
  initialized: boolean;
  permissionState: AndroidHealthPermissionState;
  grantedPermissionKeys: string[];
  requiredPermissionKeys: string[];
  missingPermissionKeys: string[];
  readCheckState: AndroidHealthReadCheckState;
  readErrorMessage: string | null;
  changesTokenExpired: boolean;
  checkedAt: string;
  syncState: AndroidHealthSyncState;
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

function defaultAuthorizationByType(): AuthorizationByType {
  return {
    HKQuantityTypeIdentifierStepCount: AuthorizationStatus.notDetermined,
    HKQuantityTypeIdentifierActiveEnergyBurned: AuthorizationStatus.notDetermined
  };
}

function toIOSTelemetryState(state: IOSHealthPermissionState): "granted" | "denied" | "revoked" | "unknown" {
  if (state === "granted" || state === "denied" || state === "revoked") {
    return state;
  }

  return "unknown";
}

function toIOSSyncState(state: IOSHealthPermissionState): IOSHealthSyncState {
  if (state === "granted") {
    return "connected";
  }

  if (state === "denied" || state === "revoked") {
    return "blocked";
  }

  return "idle";
}

function toPermissionKey(permission: { accessType: string; recordType: string }): string {
  return `${permission.accessType}:${permission.recordType}`;
}

function requiredAndroidPermissionKeys(): string[] {
  return ANDROID_HEALTH_READ_PERMISSIONS.map((permission) => toPermissionKey(permission));
}

function mapGrantedPermissionsToKeys(permissions: { accessType: string; recordType: string }[]): string[] {
  const keys = permissions.map((permission) => toPermissionKey(permission));
  return Array.from(new Set(keys)).sort();
}

function deriveMissingPermissionKeys(grantedKeys: string[]): string[] {
  const grantedSet = new Set(grantedKeys);
  return requiredAndroidPermissionKeys().filter((required) => !grantedSet.has(required));
}

function mapSdkStatusToAvailability(status: number): AndroidHealthProviderAvailability {
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
    return "available";
  }

  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return "update_required";
  }

  return "unavailable";
}

function mapAvailabilityToProviderVersion(availability: AndroidHealthProviderAvailability): AndroidHealthProviderVersion {
  if (availability === "available") {
    return "up_to_date";
  }

  if (availability === "update_required") {
    return "update_required";
  }

  return "unknown";
}

function classifyAndroidReadError(error: unknown): { state: AndroidHealthReadCheckState; message: string } {
  const mapped = mapApiError(error, "Failed to read Health Connect records.");
  const normalized = mapped.message.toLowerCase();

  if (normalized.includes("token") && normalized.includes("expir")) {
    return {
      state: "token_expired",
      message: mapped.message
    };
  }

  if (normalized.includes("permission") || normalized.includes("not granted")) {
    return {
      state: "permission_denied",
      message: mapped.message
    };
  }

  if (normalized.includes("provider") || normalized.includes("sdk") || normalized.includes("unavailable")) {
    return {
      state: "provider_disabled",
      message: mapped.message
    };
  }

  return {
    state: "unknown_error",
    message: mapped.message
  };
}

function toAndroidTelemetryPermissionState(state: AndroidHealthPermissionState): "granted" | "denied" | "unknown" {
  if (state === "granted") {
    return "granted";
  }

  if (state === "denied") {
    return "denied";
  }

  return "unknown";
}

function toAndroidSyncState(args: {
  availability: AndroidHealthProviderAvailability;
  permissionState: AndroidHealthPermissionState;
  readCheckState: AndroidHealthReadCheckState;
}): AndroidHealthSyncState {
  if (args.availability !== "available") {
    return "blocked";
  }

  if (args.permissionState !== "granted") {
    return "blocked";
  }

  if (args.readCheckState === "ok" || args.readCheckState === "not_checked") {
    return "connected";
  }

  return "blocked";
}

async function readEverGrantedFlag(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(EVER_GRANTED_KEY);
    return value === "true";
  } catch (error) {
    const mapped = mapApiError(error, "Failed to read HealthKit permission history.");
    captureHandledError("healthkit.permission.history.read", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    return false;
  }
}

async function writeEverGrantedFlag(): Promise<void> {
  try {
    await AsyncStorage.setItem(EVER_GRANTED_KEY, "true");
  } catch (error) {
    const mapped = mapApiError(error, "Failed to store HealthKit permission history.");
    captureHandledError("healthkit.permission.history.write", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
  }
}

async function readAndroidPermissionRequestedFlag(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ANDROID_PERMISSION_REQUESTED_KEY);
    return value === "true";
  } catch (error) {
    const mapped = mapApiError(error, "Failed to read Health Connect permission request history.");
    captureHandledError("healthconnect.permission.history.read", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    return false;
  }
}

async function writeAndroidPermissionRequestedFlag(): Promise<void> {
  try {
    await AsyncStorage.setItem(ANDROID_PERMISSION_REQUESTED_KEY, "true");
  } catch (error) {
    const mapped = mapApiError(error, "Failed to store Health Connect permission request history.");
    captureHandledError("healthconnect.permission.history.write", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
  }
}

async function readAndroidChangesToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ANDROID_CHANGES_TOKEN_KEY);
  } catch (error) {
    const mapped = mapApiError(error, "Failed to read Health Connect changes token.");
    captureHandledError("healthconnect.token.read", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    return null;
  }
}

function deriveIOSPermissionState(args: {
  available: boolean;
  everGranted: boolean;
  requestStatus: AuthorizationRequestStatus | null;
  authorizationByType: AuthorizationByType;
}): IOSHealthPermissionState {
  const { available, everGranted, requestStatus, authorizationByType } = args;

  if (!available) {
    return "unavailable";
  }

  const statuses = Object.values(authorizationByType);
  const allAuthorized = statuses.every((status) => status === AuthorizationStatus.sharingAuthorized);
  if (allAuthorized) {
    return "granted";
  }

  const hasDenied = statuses.some((status) => status === AuthorizationStatus.sharingDenied);
  if (hasDenied) {
    return everGranted ? "revoked" : "denied";
  }

  if (requestStatus === AuthorizationRequestStatus.shouldRequest) {
    return "notDetermined";
  }

  return "notDetermined";
}

async function readIOSAuthorizationByType(): Promise<AuthorizationByType> {
  return {
    HKQuantityTypeIdentifierStepCount: authorizationStatusFor("HKQuantityTypeIdentifierStepCount"),
    HKQuantityTypeIdentifierActiveEnergyBurned: authorizationStatusFor("HKQuantityTypeIdentifierActiveEnergyBurned")
  };
}

function isIOSHealthFeatureEnabled(): boolean {
  return Platform.OS === "ios" && healthFlags.enabled && healthFlags.ios;
}

function isAndroidHealthFeatureEnabled(): boolean {
  return Platform.OS === "android" && healthFlags.enabled && healthFlags.android;
}

function buildIOSUnavailableSnapshot(): IOSHealthPermissionSnapshot {
  return {
    state: "unavailable",
    syncState: "idle",
    requestStatus: null,
    authorizationByType: defaultAuthorizationByType(),
    available: false,
    checkedAt: new Date().toISOString()
  };
}

function buildAndroidSnapshot(args: {
  providerAvailable: boolean;
  providerAvailability: AndroidHealthProviderAvailability;
  providerVersion: AndroidHealthProviderVersion;
  sdkStatus: number | null;
  initialized: boolean;
  permissionState: AndroidHealthPermissionState;
  grantedPermissionKeys: string[];
  missingPermissionKeys: string[];
  readCheckState: AndroidHealthReadCheckState;
  readErrorMessage: string | null;
  changesTokenExpired: boolean;
}): AndroidHealthConnectSnapshot {
  return {
    providerAvailable: args.providerAvailable,
    providerAvailability: args.providerAvailability,
    providerVersion: args.providerVersion,
    sdkStatus: args.sdkStatus,
    initialized: args.initialized,
    permissionState: args.permissionState,
    grantedPermissionKeys: args.grantedPermissionKeys,
    requiredPermissionKeys: requiredAndroidPermissionKeys(),
    missingPermissionKeys: args.missingPermissionKeys,
    readCheckState: args.readCheckState,
    readErrorMessage: args.readErrorMessage,
    changesTokenExpired: args.changesTokenExpired,
    checkedAt: new Date().toISOString(),
    syncState: toAndroidSyncState({
      availability: args.providerAvailability,
      permissionState: args.permissionState,
      readCheckState: args.readCheckState
    })
  };
}

async function probeAndroidReadState(): Promise<{
  readCheckState: AndroidHealthReadCheckState;
  readErrorMessage: string | null;
  changesTokenExpired: boolean;
}> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  try {
    await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: start.toISOString(),
        endTime: end.toISOString()
      }
    });

    const previousToken = await readAndroidChangesToken();
    const changes = await getChanges({
      changesToken: previousToken ?? undefined,
      recordTypes: [...ANDROID_HEALTH_RECORD_TYPES]
    });

    if (changes.changesTokenExpired) {
      return {
        readCheckState: "token_expired",
        readErrorMessage: "Health Connect changes token expired. Reconnect provider and retry sync.",
        changesTokenExpired: true
      };
    }

    return {
      readCheckState: "ok",
      readErrorMessage: null,
      changesTokenExpired: false
    };
  } catch (error) {
    const classified = classifyAndroidReadError(error);

    return {
      readCheckState: classified.state,
      readErrorMessage: classified.message,
      changesTokenExpired: classified.state === "token_expired"
    };
  }
}

export async function getIOSHealthPermissionSnapshot(): Promise<IOSHealthPermissionSnapshot> {
  if (!isIOSHealthFeatureEnabled()) {
    const snapshot = buildIOSUnavailableSnapshot();
    trackHealthPermissionState("unknown", "healthkit");
    return snapshot;
  }

  try {
    const available = await isHealthDataAvailableAsync();
    if (!available) {
      const snapshot = buildIOSUnavailableSnapshot();
      trackHealthPermissionState("unknown", "healthkit");
      return snapshot;
    }

    const requestStatus = await getRequestStatusForAuthorization({
      toRead: IOS_HEALTH_READ_TYPES
    });

    const authorizationByType = await readIOSAuthorizationByType();
    const everGranted = await readEverGrantedFlag();
    const state = deriveIOSPermissionState({
      available,
      everGranted,
      requestStatus,
      authorizationByType
    });

    if (state === "granted") {
      await writeEverGrantedFlag();
    }

    const snapshot: IOSHealthPermissionSnapshot = {
      state,
      syncState: toIOSSyncState(state),
      requestStatus,
      authorizationByType,
      available,
      checkedAt: new Date().toISOString()
    };

    trackHealthPermissionState(toIOSTelemetryState(state), "healthkit");
    trackTelemetryEvent("health.sync.state.transition", {
      provider: "healthkit",
      permission_state: state,
      sync_state: snapshot.syncState
    });

    return snapshot;
  } catch (error) {
    const mapped = mapApiError(error, "Failed to load HealthKit permission state.");
    captureHandledError("healthkit.permission.snapshot", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}

export async function requestIOSHealthPermission(): Promise<IOSHealthPermissionSnapshot> {
  if (!isIOSHealthFeatureEnabled()) {
    throw toError("HealthKit is not enabled for this build/profile.", 400);
  }

  try {
    const available = await isHealthDataAvailableAsync();
    if (!available) {
      throw toError("Health data is unavailable on this device.", 400);
    }

    await requestAuthorization({
      toRead: IOS_HEALTH_READ_TYPES
    });

    return await getIOSHealthPermissionSnapshot();
  } catch (error) {
    const mapped = mapApiError(error, "Failed to request HealthKit permission.");
    captureHandledError("healthkit.permission.request", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}

export async function openIOSHealthSettings(): Promise<void> {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    await Linking.openSettings();
    trackTelemetryEvent("health.permission.settings_opened", {
      provider: "healthkit"
    });
  } catch (error) {
    const mapped = mapApiError(error, "Failed to open iOS settings.");
    captureHandledError("healthkit.settings.open", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}

export async function getAndroidHealthConnectSnapshot(): Promise<AndroidHealthConnectSnapshot> {
  if (Platform.OS !== "android") {
    return buildAndroidSnapshot({
      providerAvailable: false,
      providerAvailability: "unsupported_platform",
      providerVersion: "unknown",
      sdkStatus: null,
      initialized: false,
      permissionState: "notRequested",
      grantedPermissionKeys: [],
      missingPermissionKeys: requiredAndroidPermissionKeys(),
      readCheckState: "not_checked",
      readErrorMessage: null,
      changesTokenExpired: false
    });
  }

  if (!isAndroidHealthFeatureEnabled()) {
    return buildAndroidSnapshot({
      providerAvailable: false,
      providerAvailability: "disabled",
      providerVersion: "unknown",
      sdkStatus: null,
      initialized: false,
      permissionState: "notRequested",
      grantedPermissionKeys: [],
      missingPermissionKeys: requiredAndroidPermissionKeys(),
      readCheckState: "not_checked",
      readErrorMessage: null,
      changesTokenExpired: false
    });
  }

  try {
    const sdkStatus = await getSdkStatus(ANDROID_PROVIDER_PACKAGE_NAME);
    const providerAvailability = mapSdkStatusToAvailability(sdkStatus);
    const providerVersion = mapAvailabilityToProviderVersion(providerAvailability);

    if (providerAvailability !== "available") {
      const blockedSnapshot = buildAndroidSnapshot({
        providerAvailable: false,
        providerAvailability,
        providerVersion,
        sdkStatus,
        initialized: false,
        permissionState: "notRequested",
        grantedPermissionKeys: [],
        missingPermissionKeys: requiredAndroidPermissionKeys(),
        readCheckState: "provider_disabled",
        readErrorMessage:
          providerAvailability === "update_required"
            ? "Health Connect provider update is required."
            : "Health Connect provider is unavailable on this device.",
        changesTokenExpired: false
      });

      trackHealthPermissionState("unknown", "health_connect");
      trackTelemetryEvent("health.provider.status", {
        provider: "health_connect",
        availability: providerAvailability,
        provider_version: providerVersion,
        sdk_status: sdkStatus
      });

      return blockedSnapshot;
    }

    const initialized = await initialize(ANDROID_PROVIDER_PACKAGE_NAME);
    const granted = await getGrantedPermissions();
    const grantedKeys = mapGrantedPermissionsToKeys(granted);
    const missingKeys = deriveMissingPermissionKeys(grantedKeys);
    const permissionRequested = await readAndroidPermissionRequestedFlag();
    const permissionState: AndroidHealthPermissionState =
      missingKeys.length === 0 ? "granted" : permissionRequested ? "denied" : "notRequested";

    const readProbe =
      permissionState === "granted"
        ? await probeAndroidReadState()
        : {
            readCheckState: "not_checked" as AndroidHealthReadCheckState,
            readErrorMessage: null,
            changesTokenExpired: false
          };

    const snapshot = buildAndroidSnapshot({
      providerAvailable: true,
      providerAvailability,
      providerVersion,
      sdkStatus,
      initialized,
      permissionState,
      grantedPermissionKeys: grantedKeys,
      missingPermissionKeys: missingKeys,
      readCheckState: readProbe.readCheckState,
      readErrorMessage: readProbe.readErrorMessage,
      changesTokenExpired: readProbe.changesTokenExpired
    });

    trackHealthPermissionState(toAndroidTelemetryPermissionState(permissionState), "health_connect");
    trackTelemetryEvent("health.provider.status", {
      provider: "health_connect",
      availability: providerAvailability,
      provider_version: providerVersion,
      sdk_status: sdkStatus
    });
    trackTelemetryEvent("health.sync.state.transition", {
      provider: "health_connect",
      permission_state: permissionState,
      sync_state: snapshot.syncState,
      read_check_state: snapshot.readCheckState
    });

    return snapshot;
  } catch (error) {
    const mapped = mapApiError(error, "Failed to load Health Connect status.");
    captureHandledError("healthconnect.snapshot", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}

export async function requestAndroidHealthConnectPermission(): Promise<AndroidHealthConnectSnapshot> {
  if (!isAndroidHealthFeatureEnabled()) {
    throw toError("Health Connect is not enabled for this build/profile.", 400);
  }

  try {
    const sdkStatus = await getSdkStatus(ANDROID_PROVIDER_PACKAGE_NAME);
    const providerAvailability = mapSdkStatusToAvailability(sdkStatus);

    if (providerAvailability === "unavailable") {
      throw toError("Health Connect provider is unavailable on this device.", 400);
    }

    if (providerAvailability === "update_required") {
      throw toError("Health Connect provider update is required.", 400);
    }

    await initialize(ANDROID_PROVIDER_PACKAGE_NAME);
    await requestPermission(ANDROID_HEALTH_READ_PERMISSIONS);
    await writeAndroidPermissionRequestedFlag();

    return await getAndroidHealthConnectSnapshot();
  } catch (error) {
    const mapped = mapApiError(error, "Failed to request Health Connect permission.");
    captureHandledError("healthconnect.permission.request", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}

export async function openAndroidHealthConnectSettings(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    openHealthConnectSettings();
    trackTelemetryEvent("health.provider.settings_opened", {
      provider: "health_connect"
    });
  } catch (error) {
    const mapped = mapApiError(error, "Failed to open Health Connect settings.");
    captureHandledError("healthconnect.settings.open", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}

export async function openAndroidHealthConnectInstallProvider(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    const canOpenMarket = await Linking.canOpenURL(ANDROID_INSTALL_MARKET_URL);
    if (canOpenMarket) {
      await Linking.openURL(ANDROID_INSTALL_MARKET_URL);
    } else {
      await Linking.openURL(ANDROID_INSTALL_WEB_URL);
    }

    trackTelemetryEvent("health.provider.install_opened", {
      provider: "health_connect"
    });
  } catch (error) {
    const mapped = mapApiError(error, "Failed to open Health Connect install/update page.");
    captureHandledError("healthconnect.provider.install", new Error(mapped.message), {
      status: mapped.status,
      code: mapped.code
    });
    throw mapped;
  }
}
