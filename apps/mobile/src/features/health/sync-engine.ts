import {
  getChanges,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  SdkAvailabilityStatus,
  type Permission
} from "react-native-health-connect";
import { isHealthDataAvailableAsync, queryQuantitySamples, queryQuantitySamplesWithAnchor, type QuantitySample } from "@kingstinct/react-native-healthkit";
import { Platform } from "react-native";

import { healthFlags } from "@/infrastructure/config/env";
import { supabase } from "@/infrastructure/supabase/client";
import { captureHandledError, trackHealthSyncMetric, trackTelemetryEvent } from "@/infrastructure/telemetry/client";

const IOS_PROVIDER = "ios" as const;
const ANDROID_PROVIDER = "android" as const;
const IOS_SOURCE_DEFAULT = "healthkit";
const ANDROID_SOURCE_DEFAULT = "health_connect";

const SYNC_RECORD_TYPES = ["steps", "activeCaloriesBurned"] as const;

const ANDROID_PROVIDER_PACKAGE_NAME = "com.google.android.apps.healthdata";

const BOOTSTRAP_DAYS = 30;
const OVERLAP_GUARD_WINDOW_MS = 20_000;

const IOS_STEP_IDENTIFIER = "HKQuantityTypeIdentifierStepCount" as const;
const IOS_ACTIVE_KCAL_IDENTIFIER = "HKQuantityTypeIdentifierActiveEnergyBurned" as const;

const ANDROID_HEALTH_READ_PERMISSIONS: Permission[] = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" }
];

type SyncRecordType = (typeof SYNC_RECORD_TYPES)[number];

type PlatformProvider = typeof IOS_PROVIDER | typeof ANDROID_PROVIDER;

type SyncGuardRuntime = {
  isRunning: boolean;
  lastStartAt: number;
};

const runtimeGuard: SyncGuardRuntime = {
  isRunning: false,
  lastStartAt: 0
};

type HealthSyncStateRow = {
  record_type: SyncRecordType;
  anchor_or_token: string | null;
  cursor_state: Record<string, unknown> | null;
  is_running: boolean;
};

type MetricSpan = {
  source: string;
  start: Date;
  end: Date;
  steps: number;
  activeKcal: number;
};

type DailyAggregate = {
  user_id: string;
  platform: PlatformProvider;
  local_date: string;
  source: string;
  steps: number;
  active_kcal: number;
  data_point_count: number;
  tz_offset_min: number;
  synced_at: string;
  last_seen_at: string;
};

type SyncWindow = {
  start: Date;
  end: Date;
};

type IOSSyncOutcome = {
  rowCount: number;
  anchorByRecord: Record<SyncRecordType, string | null>;
  window: SyncWindow | null;
  resetApplied: boolean;
};

type AndroidSyncOutcome = {
  rowCount: number;
  token: string | null;
  window: SyncWindow | null;
  resetApplied: boolean;
};

type SyncResult = {
  status: "success" | "skipped";
  reason: string;
  provider?: PlatformProvider;
  rowCount?: number;
};

type AndroidStepsRecord = {
  startTime: string;
  endTime: string;
  count: number;
  metadata?: {
    dataOrigin?: string;
  };
};

type AndroidActiveCaloriesRecord = {
  startTime: string;
  endTime: string;
  energy: {
    inKilocalories?: number;
    inCalories?: number;
    inJoules?: number;
    inKilojoules?: number;
  };
  metadata?: {
    dataOrigin?: string;
  };
};

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tzOffsetMinutes(date: Date): number {
  return -date.getTimezoneOffset();
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function clampWindow(window: SyncWindow): SyncWindow {
  const maxStart = addDays(window.end, -BOOTSTRAP_DAYS);
  if (window.start < maxStart) {
    return {
      start: maxStart,
      end: window.end
    };
  }

  return window;
}

function bootstrapWindow(reference = new Date()): SyncWindow {
  return {
    start: addDays(startOfLocalDay(reference), -BOOTSTRAP_DAYS),
    end: reference
  };
}

function splitByLocalMidnight(start: Date, end: Date): Array<{ start: Date; end: Date; ratio: number; localDate: string; tzOffsetMin: number }> {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  const normalizedEnd = end > start ? end : new Date(start.getTime() + 1);
  const totalMs = normalizedEnd.getTime() - start.getTime();

  const segments: Array<{ start: Date; end: Date; ratio: number; localDate: string; tzOffsetMin: number }> = [];
  let cursor = new Date(start);

  while (cursor < normalizedEnd) {
    const nextMidnight = new Date(cursor);
    nextMidnight.setHours(24, 0, 0, 0);

    const segmentEnd = nextMidnight < normalizedEnd ? nextMidnight : normalizedEnd;
    const ratio = (segmentEnd.getTime() - cursor.getTime()) / totalMs;

    segments.push({
      start: new Date(cursor),
      end: new Date(segmentEnd),
      ratio,
      localDate: toLocalDateString(cursor),
      tzOffsetMin: tzOffsetMinutes(cursor)
    });

    cursor = new Date(segmentEnd);
  }

  return segments;
}

function buildAggregateRows(userId: string, platform: PlatformProvider, spans: MetricSpan[], syncedAt: string): DailyAggregate[] {
  const map = new Map<string, DailyAggregate>();

  for (const span of spans) {
    const segments = splitByLocalMidnight(span.start, span.end);
    if (segments.length === 0) {
      continue;
    }

    for (const segment of segments) {
      const key = `${platform}:${segment.localDate}:${span.source}`;
      const prev = map.get(key);

      const next: DailyAggregate = prev ?? {
        user_id: userId,
        platform,
        local_date: segment.localDate,
        source: span.source,
        steps: 0,
        active_kcal: 0,
        data_point_count: 0,
        tz_offset_min: segment.tzOffsetMin,
        synced_at: syncedAt,
        last_seen_at: syncedAt
      };

      next.steps += span.steps * segment.ratio;
      next.active_kcal += span.activeKcal * segment.ratio;
      next.data_point_count += 1;
      next.tz_offset_min = segment.tzOffsetMin;
      next.synced_at = syncedAt;
      next.last_seen_at = syncedAt;

      map.set(key, next);
    }
  }

  return Array.from(map.values()).map((row) => ({
    ...row,
    steps: Math.round(row.steps),
    active_kcal: Number(row.active_kcal.toFixed(3))
  }));
}

function resolveWindowFromSpans(spans: MetricSpan[]): SyncWindow | null {
  if (spans.length === 0) {
    return null;
  }

  let start = spans[0].start;
  let end = spans[0].end;

  for (const span of spans.slice(1)) {
    if (span.start < start) {
      start = span.start;
    }
    if (span.end > end) {
      end = span.end;
    }
  }

  return clampWindow({ start, end });
}

function metricWindowBounds(window: SyncWindow): { startDate: string; endDate: string } {
  const startDate = toLocalDateString(window.start);
  const endDate = toLocalDateString(window.end);
  return { startDate, endDate };
}

function captureError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  captureHandledError(scope, new Error(message), {});
}

function isAnchorResetError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("anchor") || message.includes("invalid") || message.includes("expired");
}

function isTokenResetError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("token") || message.includes("expired") || message.includes("invalid");
}

function sourceFromIOS(sample: QuantitySample): string {
  return sample.sourceRevision?.source?.bundleIdentifier ?? sample.sourceRevision?.source?.name ?? IOS_SOURCE_DEFAULT;
}

function activeKcalFromIOS(sample: QuantitySample): number {
  const unit = sample.unit.toLowerCase();
  const value = sample.quantity;

  if (unit.includes("kcal") || unit === "cal") {
    return value;
  }

  if (unit.includes("kj")) {
    return value / 4.184;
  }

  if (unit.includes("j")) {
    return value / 4184;
  }

  return value;
}

function activeKcalFromAndroid(record: AndroidActiveCaloriesRecord): number {
  if (typeof record.energy.inKilocalories === "number") {
    return record.energy.inKilocalories;
  }
  if (typeof record.energy.inCalories === "number") {
    return record.energy.inCalories;
  }
  if (typeof record.energy.inKilojoules === "number") {
    return record.energy.inKilojoules / 4.184;
  }
  if (typeof record.energy.inJoules === "number") {
    return record.energy.inJoules / 4184;
  }
  return 0;
}

function ensureDates(startIso: string, endIso: string): { start: Date; end: Date } | null {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return { start, end };
}

async function resolveUserId(): Promise<string | null> {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.user?.id) {
    return null;
  }

  return session.user.id;
}

async function loadSyncStateMap(userId: string, platform: PlatformProvider): Promise<Map<SyncRecordType, HealthSyncStateRow>> {
  const { data, error } = await supabase
    .from("health_sync_state")
    .select("record_type,anchor_or_token,cursor_state,is_running")
    .eq("user_id", userId)
    .eq("platform", platform)
    .in("record_type", [...SYNC_RECORD_TYPES]);

  if (error) {
    throw new Error(error.message || "Failed to load health sync state.");
  }

  const map = new Map<SyncRecordType, HealthSyncStateRow>();
  const rows = (data ?? []) as HealthSyncStateRow[];

  for (const row of rows) {
    map.set(row.record_type, row);
  }

  return map;
}

async function upsertSyncStateRows(rows: Array<Record<string, unknown>>): Promise<void> {
  const { error } = await supabase.from("health_sync_state").upsert(rows, {
    onConflict: "user_id,platform,record_type"
  });

  if (error) {
    throw new Error(error.message || "Failed to upsert health sync state.");
  }
}

async function markSyncRunning(userId: string, platform: PlatformProvider, isRunning: boolean, nowIso: string, reason?: string): Promise<void> {
  const rows = SYNC_RECORD_TYPES.map((recordType) => ({
    user_id: userId,
    platform,
    record_type: recordType,
    is_running: isRunning,
    cursor_version: 1,
    cursor_state: {
      lastStartAt: nowIso,
      reason: reason ?? null
    }
  }));

  await upsertSyncStateRows(rows);
}

async function markSyncFailure(userId: string, platform: PlatformProvider, errorMessage: string, nowIso: string): Promise<void> {
  const rows = SYNC_RECORD_TYPES.map((recordType) => ({
    user_id: userId,
    platform,
    record_type: recordType,
    is_running: false,
    last_error_at: nowIso,
    error_message: errorMessage.slice(0, 300),
    cursor_version: 1,
    cursor_state: {
      lastErrorAt: nowIso
    }
  }));

  await upsertSyncStateRows(rows);
}

async function commitDailyMetricsWindow(userId: string, platform: PlatformProvider, window: SyncWindow, rows: DailyAggregate[]): Promise<number> {
  const bounds = metricWindowBounds(window);

  const { error: deleteError } = await supabase
    .from("health_daily_metrics")
    .delete()
    .eq("user_id", userId)
    .eq("platform", platform)
    .gte("local_date", bounds.startDate)
    .lte("local_date", bounds.endDate);

  if (deleteError) {
    throw new Error(deleteError.message || "Failed to reset health metrics window.");
  }

  if (rows.length === 0) {
    return 0;
  }

  const { error: upsertError } = await supabase.from("health_daily_metrics").upsert(rows, {
    onConflict: "user_id,platform,local_date,source"
  });

  if (upsertError) {
    throw new Error(upsertError.message || "Failed to upsert daily health metrics.");
  }

  return rows.length;
}

async function queryIOSWithAnchor(identifier: typeof IOS_STEP_IDENTIFIER | typeof IOS_ACTIVE_KCAL_IDENTIFIER, anchor: string | null): Promise<{ samples: readonly QuantitySample[]; deletedCount: number; newAnchor: string; resetApplied: boolean }> {
  try {
    const response = await queryQuantitySamplesWithAnchor(identifier, {
      limit: -1,
      anchor: anchor ?? undefined,
      unit: identifier === IOS_STEP_IDENTIFIER ? "count" : "kcal"
    });

    return {
      samples: response.samples,
      deletedCount: response.deletedSamples.length,
      newAnchor: response.newAnchor,
      resetApplied: false
    };
  } catch (error) {
    if (anchor && isAnchorResetError(error)) {
      const response = await queryQuantitySamplesWithAnchor(identifier, {
        limit: -1,
        unit: identifier === IOS_STEP_IDENTIFIER ? "count" : "kcal"
      });

      return {
        samples: response.samples,
        deletedCount: response.deletedSamples.length,
        newAnchor: response.newAnchor,
        resetApplied: true
      };
    }

    throw error;
  }
}

async function readIOSWindowSamples(window: SyncWindow): Promise<MetricSpan[]> {
  const baseOptions = {
    limit: -1,
    ascending: true,
    filter: {
      date: {
        startDate: window.start,
        endDate: window.end
      }
    }
  } as const;

  const [stepSamples, activeSamples] = await Promise.all([
    queryQuantitySamples(IOS_STEP_IDENTIFIER, { ...baseOptions, unit: "count" }),
    queryQuantitySamples(IOS_ACTIVE_KCAL_IDENTIFIER, { ...baseOptions, unit: "kcal" })
  ]);

  const spans: MetricSpan[] = [];

  for (const sample of stepSamples) {
    spans.push({
      source: sourceFromIOS(sample),
      start: sample.startDate,
      end: sample.endDate,
      steps: sample.quantity,
      activeKcal: 0
    });
  }

  for (const sample of activeSamples) {
    spans.push({
      source: sourceFromIOS(sample),
      start: sample.startDate,
      end: sample.endDate,
      steps: 0,
      activeKcal: activeKcalFromIOS(sample)
    });
  }

  return spans;
}

async function runIOSDeferredSync(userId: string, trigger: string, startedAtIso: string): Promise<IOSSyncOutcome> {
  const available = await isHealthDataAvailableAsync();
  if (!available) {
    return {
      rowCount: 0,
      anchorByRecord: {
        steps: null,
        activeCaloriesBurned: null
      },
      window: null,
      resetApplied: false
    };
  }

  const syncState = await loadSyncStateMap(userId, IOS_PROVIDER);
  const stepAnchor = syncState.get("steps")?.anchor_or_token ?? null;
  const activeAnchor = syncState.get("activeCaloriesBurned")?.anchor_or_token ?? null;

  const [stepDelta, activeDelta] = await Promise.all([
    queryIOSWithAnchor(IOS_STEP_IDENTIFIER, stepAnchor),
    queryIOSWithAnchor(IOS_ACTIVE_KCAL_IDENTIFIER, activeAnchor)
  ]);

  const changedSpans: MetricSpan[] = [
    ...stepDelta.samples.map((sample) => ({
      source: sourceFromIOS(sample),
      start: sample.startDate,
      end: sample.endDate,
      steps: sample.quantity,
      activeKcal: 0
    })),
    ...activeDelta.samples.map((sample) => ({
      source: sourceFromIOS(sample),
      start: sample.startDate,
      end: sample.endDate,
      steps: 0,
      activeKcal: activeKcalFromIOS(sample)
    }))
  ];

  const hasDeleted = stepDelta.deletedCount > 0 || activeDelta.deletedCount > 0;
  const resetApplied = stepDelta.resetApplied || activeDelta.resetApplied;
  const shouldBootstrap = !stepAnchor || !activeAnchor || hasDeleted || resetApplied;

  const window = shouldBootstrap ? bootstrapWindow() : resolveWindowFromSpans(changedSpans);

  let rowCount = 0;
  if (window) {
    const fullWindowSpans = await readIOSWindowSamples(window);
    const rows = buildAggregateRows(userId, IOS_PROVIDER, fullWindowSpans, startedAtIso);
    rowCount = await commitDailyMetricsWindow(userId, IOS_PROVIDER, window, rows);
  }

  await upsertSyncStateRows(
    SYNC_RECORD_TYPES.map((recordType) => ({
      user_id: userId,
      platform: IOS_PROVIDER,
      record_type: recordType,
      anchor_or_token: recordType === "steps" ? stepDelta.newAnchor : activeDelta.newAnchor,
      cursor_state: {
        trigger,
        resetApplied,
        windowStart: window ? window.start.toISOString() : null,
        windowEnd: window ? window.end.toISOString() : null
      },
      last_success_at: startedAtIso,
      last_error_at: null,
      error_message: null,
      cursor_version: 1,
      is_running: false
    }))
  );

  return {
    rowCount,
    anchorByRecord: {
      steps: stepDelta.newAnchor,
      activeCaloriesBurned: activeDelta.newAnchor
    },
    window,
    resetApplied
  };
}

async function fetchAndroidChanges(previousToken: string | null): Promise<{
  nextToken: string;
  tokenExpired: boolean;
  upsertionSpans: MetricSpan[];
  deletionCount: number;
  resetApplied: boolean;
}> {
  try {
    const response = await getChanges({
      changesToken: previousToken ?? undefined,
      recordTypes: ["Steps", "ActiveCaloriesBurned"]
    });

    const upsertionSpans: MetricSpan[] = [];

    for (const item of response.upsertionChanges) {
      const record = item.record as unknown as Record<string, unknown>;
      const recordType = typeof record.recordType === "string" ? record.recordType : "";
      const startIso = typeof record.startTime === "string" ? record.startTime : null;
      const endIso = typeof record.endTime === "string" ? record.endTime : null;

      if (!startIso || !endIso) {
        continue;
      }

      const dates = ensureDates(startIso, endIso);
      if (!dates) {
        continue;
      }

      const metadata = (record.metadata as { dataOrigin?: string } | undefined) ?? undefined;
      const source = metadata?.dataOrigin ?? ANDROID_SOURCE_DEFAULT;

      if (recordType === "Steps") {
        const count = typeof record.count === "number" ? record.count : 0;
        upsertionSpans.push({
          source,
          start: dates.start,
          end: dates.end,
          steps: count,
          activeKcal: 0
        });
      }

      if (recordType === "ActiveCaloriesBurned") {
        const energy = (record.energy as { inKilocalories?: number; inCalories?: number; inJoules?: number; inKilojoules?: number } | undefined) ??
          {};
        const kcal =
          typeof energy.inKilocalories === "number"
            ? energy.inKilocalories
            : typeof energy.inCalories === "number"
              ? energy.inCalories
              : typeof energy.inKilojoules === "number"
                ? energy.inKilojoules / 4.184
                : typeof energy.inJoules === "number"
                  ? energy.inJoules / 4184
                  : 0;

        upsertionSpans.push({
          source,
          start: dates.start,
          end: dates.end,
          steps: 0,
          activeKcal: kcal
        });
      }
    }

    return {
      nextToken: response.nextChangesToken,
      tokenExpired: response.changesTokenExpired,
      upsertionSpans,
      deletionCount: response.deletionChanges.length,
      resetApplied: false
    };
  } catch (error) {
    if (previousToken && isTokenResetError(error)) {
      const response = await getChanges({
        recordTypes: ["Steps", "ActiveCaloriesBurned"]
      });

      return {
        nextToken: response.nextChangesToken,
        tokenExpired: true,
        upsertionSpans: [],
        deletionCount: response.deletionChanges.length,
        resetApplied: true
      };
    }

    throw error;
  }
}

async function readAndroidWindowSamples(window: SyncWindow): Promise<MetricSpan[]> {
  const [stepsResult, activeResult] = await Promise.all([
    readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: window.start.toISOString(),
        endTime: window.end.toISOString()
      }
    }),
    readRecords("ActiveCaloriesBurned", {
      timeRangeFilter: {
        operator: "between",
        startTime: window.start.toISOString(),
        endTime: window.end.toISOString()
      }
    })
  ]);

  const spans: MetricSpan[] = [];

  for (const record of stepsResult.records as AndroidStepsRecord[]) {
    const dates = ensureDates(record.startTime, record.endTime);
    if (!dates) {
      continue;
    }

    spans.push({
      source: record.metadata?.dataOrigin ?? ANDROID_SOURCE_DEFAULT,
      start: dates.start,
      end: dates.end,
      steps: record.count,
      activeKcal: 0
    });
  }

  for (const record of activeResult.records as AndroidActiveCaloriesRecord[]) {
    const dates = ensureDates(record.startTime, record.endTime);
    if (!dates) {
      continue;
    }

    spans.push({
      source: record.metadata?.dataOrigin ?? ANDROID_SOURCE_DEFAULT,
      start: dates.start,
      end: dates.end,
      steps: 0,
      activeKcal: activeKcalFromAndroid(record)
    });
  }

  return spans;
}

async function runAndroidDeferredSync(userId: string, trigger: string, startedAtIso: string): Promise<AndroidSyncOutcome> {
  const sdkStatus = await getSdkStatus(ANDROID_PROVIDER_PACKAGE_NAME);
  if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return {
      rowCount: 0,
      token: null,
      window: null,
      resetApplied: false
    };
  }

  await initialize(ANDROID_PROVIDER_PACKAGE_NAME);

  const granted = await getGrantedPermissions();
  const grantedKeys = new Set(granted.map((permission) => `${permission.accessType}:${permission.recordType}`));
  const allRequiredGranted = ANDROID_HEALTH_READ_PERMISSIONS.every((permission) => grantedKeys.has(`${permission.accessType}:${permission.recordType}`));

  if (!allRequiredGranted) {
    return {
      rowCount: 0,
      token: null,
      window: null,
      resetApplied: false
    };
  }

  const syncState = await loadSyncStateMap(userId, ANDROID_PROVIDER);
  const previousToken = syncState.get("steps")?.anchor_or_token ?? syncState.get("activeCaloriesBurned")?.anchor_or_token ?? null;

  const changes = await fetchAndroidChanges(previousToken);

  const shouldBootstrap = !previousToken || changes.tokenExpired || changes.resetApplied || changes.deletionCount > 0;
  const window = shouldBootstrap ? bootstrapWindow() : resolveWindowFromSpans(changes.upsertionSpans);

  let rowCount = 0;
  if (window) {
    const spans = await readAndroidWindowSamples(window);
    const rows = buildAggregateRows(userId, ANDROID_PROVIDER, spans, startedAtIso);
    rowCount = await commitDailyMetricsWindow(userId, ANDROID_PROVIDER, window, rows);
  }

  await upsertSyncStateRows(
    SYNC_RECORD_TYPES.map((recordType) => ({
      user_id: userId,
      platform: ANDROID_PROVIDER,
      record_type: recordType,
      anchor_or_token: changes.nextToken,
      cursor_state: {
        trigger,
        resetApplied: changes.resetApplied || changes.tokenExpired,
        tokenExpired: changes.tokenExpired,
        windowStart: window ? window.start.toISOString() : null,
        windowEnd: window ? window.end.toISOString() : null
      },
      last_success_at: startedAtIso,
      last_error_at: null,
      error_message: null,
      cursor_version: 1,
      is_running: false
    }))
  );

  return {
    rowCount,
    token: changes.nextToken,
    window,
    resetApplied: changes.resetApplied || changes.tokenExpired
  };
}

export async function runDeferredHealthSync(trigger = "manual"): Promise<SyncResult> {
  const now = Date.now();
  if (runtimeGuard.isRunning) {
    return {
      status: "skipped",
      reason: "sync_already_running"
    };
  }

  if (runtimeGuard.lastStartAt > 0 && now - runtimeGuard.lastStartAt < OVERLAP_GUARD_WINDOW_MS) {
    return {
      status: "skipped",
      reason: "sync_guard_window"
    };
  }

  if (!healthFlags.enabled) {
    return {
      status: "skipped",
      reason: "health_feature_disabled"
    };
  }

  const userId = await resolveUserId();
  if (!userId) {
    return {
      status: "skipped",
      reason: "unauthenticated"
    };
  }

  const platform = Platform.OS;
  if (platform !== "ios" && platform !== "android") {
    return {
      status: "skipped",
      reason: "unsupported_platform"
    };
  }

  const provider: PlatformProvider = platform === "ios" ? IOS_PROVIDER : ANDROID_PROVIDER;
  const startedAtIso = new Date(now).toISOString();

  runtimeGuard.isRunning = true;
  runtimeGuard.lastStartAt = now;

  try {
    await markSyncRunning(userId, provider, true, startedAtIso, trigger);

    if (provider === IOS_PROVIDER) {
      if (!healthFlags.ios) {
        await markSyncRunning(userId, provider, false, startedAtIso, "ios_flag_disabled");
        return {
          status: "skipped",
          reason: "ios_flag_disabled",
          provider
        };
      }

      const outcome = await runIOSDeferredSync(userId, trigger, startedAtIso);
      const durationMs = Date.now() - now;
      trackTelemetryEvent("health.sync.orchestrator.completed", {
        provider,
        trigger,
        row_count: outcome.rowCount,
        duration_ms: durationMs,
        reset_applied: outcome.resetApplied,
        window_start: outcome.window ? outcome.window.start.toISOString() : null,
        window_end: outcome.window ? outcome.window.end.toISOString() : null
      });
      trackHealthSyncMetric("rows_committed", outcome.rowCount, "count");

      return {
        status: "success",
        reason: "sync_completed",
        provider,
        rowCount: outcome.rowCount
      };
    }

    if (!healthFlags.android) {
      await markSyncRunning(userId, provider, false, startedAtIso, "android_flag_disabled");
      return {
        status: "skipped",
        reason: "android_flag_disabled",
        provider
      };
    }

    const outcome = await runAndroidDeferredSync(userId, trigger, startedAtIso);
    const durationMs = Date.now() - now;
    trackTelemetryEvent("health.sync.orchestrator.completed", {
      provider,
      trigger,
      row_count: outcome.rowCount,
      duration_ms: durationMs,
      reset_applied: outcome.resetApplied,
      window_start: outcome.window ? outcome.window.start.toISOString() : null,
      window_end: outcome.window ? outcome.window.end.toISOString() : null
    });
    trackHealthSyncMetric("rows_committed", outcome.rowCount, "count");

    return {
      status: "success",
      reason: "sync_completed",
      provider,
      rowCount: outcome.rowCount
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health sync failed.";
    captureError("health.sync.orchestrator", error);
    await markSyncFailure(userId, provider, message, new Date().toISOString());

    throw error;
  } finally {
    runtimeGuard.isRunning = false;
  }
}
