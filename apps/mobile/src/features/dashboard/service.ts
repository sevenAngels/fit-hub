import type { ApiClientError } from "@/infrastructure/api/client";
import { healthFlags } from "@/infrastructure/config/env";
import { supabase } from "@/infrastructure/supabase/client";
import { Platform } from "react-native";

type MealNutritionRow = {
  total_calories: number | null;
  total_carbohydrates_g: number | null;
  total_protein_g: number | null;
  total_fat_g: number | null;
};

type GoalRow = {
  id: string;
  title: string | null;
  current_value: number | null;
  target_value: number | null;
  goal_type: string;
};

type StreakRow = {
  current_streak: number | null;
};

type MoodRow = {
  emotion: string | null;
  mood_status: string | null;
  mood_type: string | null;
  stress_level: number | null;
  sleep_hours: number | null;
  updated_at: string | null;
};

type HealthDailyMetricRow = {
  local_date: string;
  steps: number | null;
  active_kcal: number | null;
  source: string | null;
  synced_at: string | null;
};

type HealthSyncStateRow = {
  last_success_at: string | null;
  is_running: boolean | null;
  error_message: string | null;
};

export type DashboardNutritionSummary = {
  date: string;
  mealsRecorded: number;
  totalCalories: number;
  totalCarbohydratesG: number;
  totalProteinG: number;
  totalFatG: number;
};

export type DashboardGoalsSummary = {
  activeCount: number;
  featuredGoalTitle: string | null;
  featuredProgressRatio: number | null;
  habitsTotal: number;
  habitsCompletedToday: number;
};

type HabitLogRow = {
  goal_id: string;
};

export type DashboardStreakSummary = {
  currentStreakDays: number;
};

export type DashboardMoodSummary = {
  date: string;
  hasEntry: boolean;
  moodStatus: string | null;
  stressLevel: number | null;
  sleepHours: number | null;
  updatedAt: string | null;
};

export type DashboardHealthSummary = {
  date: string;
  hasData: boolean;
  steps: number;
  activeKcal: number;
  sourceCount: number;
  lastSuccessAt: string | null;
  stale: boolean;
  isRunning: boolean;
  syncState: "connected" | "stale" | "reconnect_required" | "disabled";
  errorMessage: string | null;
};

const HEALTH_STALE_THRESHOLD_HOURS = 72;
const HEALTH_STALE_THRESHOLD_MS = HEALTH_STALE_THRESHOLD_HOURS * 60 * 60 * 1000;

function toError(message: string, status = 500): ApiClientError {
  return {
    status,
    code: "unknown",
    message
  };
}

function toTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toPositiveNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toRatio(current: number, target: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) {
    return null;
  }

  const ratio = current / target;
  return Math.max(0, Math.min(1, ratio));
}

function resolveHealthPlatform(): "ios" | "android" | null {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return Platform.OS;
  }

  return null;
}

function isHealthEnabledForPlatform(platform: "ios" | "android" | null): boolean {
  if (!platform || !healthFlags.enabled) {
    return false;
  }

  return platform === "ios" ? healthFlags.ios : healthFlags.android;
}

function maxIsoTimestamp(a: string | null, b: string | null): string | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }

  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (!Number.isFinite(aTime)) {
    return b;
  }
  if (!Number.isFinite(bTime)) {
    return a;
  }

  return bTime > aTime ? b : a;
}

function disabledHealthSummary(date: string): DashboardHealthSummary {
  return {
    date,
    hasData: false,
    steps: 0,
    activeKcal: 0,
    sourceCount: 0,
    lastSuccessAt: null,
    stale: false,
    isRunning: false,
    syncState: "disabled",
    errorMessage: null
  };
}

async function resolveUserIdOrError(): Promise<string> {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    throw toError("Authentication required.", 401);
  }

  return session.user.id;
}

export async function getDashboardNutritionSummary(date = toTodayDate()): Promise<DashboardNutritionSummary> {
  const userId = await resolveUserIdOrError();

  const { data, error } = await supabase
    .from("meal_records")
    .select("total_calories,total_carbohydrates_g,total_protein_g,total_fat_g")
    .eq("user_id", userId)
    .eq("record_date", date);

  if (error) {
    throw toError(error.message || "Failed to load dashboard nutrition.", 500);
  }

  const rows = (data as MealNutritionRow[] | null) ?? [];

  return rows.reduce<DashboardNutritionSummary>(
    (summary, row) => ({
      ...summary,
      mealsRecorded: summary.mealsRecorded + 1,
      totalCalories: summary.totalCalories + toPositiveNumber(row.total_calories),
      totalCarbohydratesG: summary.totalCarbohydratesG + toPositiveNumber(row.total_carbohydrates_g),
      totalProteinG: summary.totalProteinG + toPositiveNumber(row.total_protein_g),
      totalFatG: summary.totalFatG + toPositiveNumber(row.total_fat_g)
    }),
    {
      date,
      mealsRecorded: 0,
      totalCalories: 0,
      totalCarbohydratesG: 0,
      totalProteinG: 0,
      totalFatG: 0
    }
  );
}

export async function getDashboardGoalsSummary(): Promise<DashboardGoalsSummary> {
  const userId = await resolveUserIdOrError();
  const today = toTodayDate();

  const { data, error } = await supabase
    .from("goals")
    .select("id,title,current_value,target_value,goal_type")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw toError(error.message || "Failed to load goals summary.", 500);
  }

  const rows = (data as GoalRow[] | null) ?? [];
  const featuredGoal = rows[0] ?? null;
  const habitGoalIds = rows.filter((goal) => goal.goal_type === "habit").map((goal) => goal.id);

  let habitsCompletedToday = 0;
  if (habitGoalIds.length > 0) {
    const { data: habitLogs, error: habitLogsError } = await supabase
      .from("habit_logs")
      .select("goal_id")
      .eq("user_id", userId)
      .eq("completed_date", today)
      .in("goal_id", habitGoalIds);

    if (habitLogsError) {
      throw toError(habitLogsError.message || "Failed to load habit completion summary.", 500);
    }

    const logRows = (habitLogs as HabitLogRow[] | null) ?? [];
    habitsCompletedToday = new Set(logRows.map((log) => log.goal_id)).size;
  }

  return {
    activeCount: rows.length,
    featuredGoalTitle: featuredGoal?.title ?? null,
    featuredProgressRatio:
      featuredGoal && typeof featuredGoal.current_value === "number" && typeof featuredGoal.target_value === "number"
        ? toRatio(featuredGoal.current_value, featuredGoal.target_value)
        : null,
    habitsTotal: habitGoalIds.length,
    habitsCompletedToday
  };
}

export async function getDashboardStreakSummary(): Promise<DashboardStreakSummary> {
  const userId = await resolveUserIdOrError();

  const { data, error } = await supabase
    .from("user_streak")
    .select("current_streak")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw toError(error.message || "Failed to load streak summary.", 500);
  }

  const row = data as StreakRow | null;
  return {
    currentStreakDays: toPositiveNumber(row?.current_streak)
  };
}

export async function getDashboardMoodSummary(date = toTodayDate()): Promise<DashboardMoodSummary> {
  const userId = await resolveUserIdOrError();

  const { data, error } = await supabase
    .from("daily_moods")
    .select("emotion,mood_status,mood_type,stress_level,sleep_hours,updated_at")
    .eq("user_id", userId)
    .eq("record_date", date)
    .maybeSingle();

  if (error) {
    throw toError(error.message || "Failed to load mood summary.", 500);
  }

  const row = data as MoodRow | null;
  if (!row) {
    return {
      date,
      hasEntry: false,
      moodStatus: null,
      stressLevel: null,
      sleepHours: null,
      updatedAt: null
    };
  }

  return {
    date,
    hasEntry: true,
    moodStatus: row.emotion ?? row.mood_status ?? row.mood_type,
    stressLevel: typeof row.stress_level === "number" ? row.stress_level : null,
    sleepHours: typeof row.sleep_hours === "number" ? row.sleep_hours : null,
    updatedAt: row.updated_at
  };
}

export async function getDashboardHealthSummary(date = toTodayDate()): Promise<DashboardHealthSummary> {
  const platform = resolveHealthPlatform();
  if (!isHealthEnabledForPlatform(platform)) {
    return disabledHealthSummary(date);
  }

  const userId = await resolveUserIdOrError();

  const [metricsResult, syncStateResult] = await Promise.all([
    supabase
      .from("health_daily_metrics")
      .select("local_date,steps,active_kcal,source,synced_at")
      .eq("user_id", userId)
      .eq("platform", platform)
      .eq("local_date", date),
    supabase
      .from("health_sync_state")
      .select("last_success_at,is_running,error_message")
      .eq("user_id", userId)
      .eq("platform", platform)
      .in("record_type", ["steps", "activeCaloriesBurned"])
  ]);

  if (metricsResult.error || syncStateResult.error) {
    throw toError(metricsResult.error?.message || syncStateResult.error?.message || "Failed to load health dashboard summary.", 500);
  }

  const metricRows = (metricsResult.data as HealthDailyMetricRow[] | null) ?? [];
  const syncRows = (syncStateResult.data as HealthSyncStateRow[] | null) ?? [];

  const steps = metricRows.reduce((sum, row) => sum + toPositiveNumber(row.steps), 0);
  const activeKcal = Number(metricRows.reduce((sum, row) => sum + toPositiveNumber(row.active_kcal), 0).toFixed(2));
  const sourceCount = new Set(metricRows.map((row) => row.source).filter((source): source is string => typeof source === "string" && source.length > 0)).size;
  const isRunning = syncRows.some((row) => row.is_running === true);
  const errorMessage = syncRows.map((row) => row.error_message).find((value): value is string => typeof value === "string" && value.length > 0) ?? null;

  let lastSuccessAt: string | null = null;
  for (const row of syncRows) {
    lastSuccessAt = maxIsoTimestamp(lastSuccessAt, row.last_success_at);
  }
  for (const row of metricRows) {
    lastSuccessAt = maxIsoTimestamp(lastSuccessAt, row.synced_at);
  }

  const stale =
    !isRunning &&
    !!lastSuccessAt &&
    Number.isFinite(new Date(lastSuccessAt).getTime()) &&
    Date.now() - new Date(lastSuccessAt).getTime() > HEALTH_STALE_THRESHOLD_MS;

  const hasData = metricRows.length > 0;
  const syncState: DashboardHealthSummary["syncState"] = !hasData && !lastSuccessAt
    ? "reconnect_required"
    : stale
      ? "stale"
      : errorMessage && !hasData
        ? "reconnect_required"
        : "connected";

  return {
    date,
    hasData,
    steps,
    activeKcal,
    sourceCount,
    lastSuccessAt,
    stale,
    isRunning,
    syncState,
    errorMessage
  };
}

export function getDashboardTodayDate(): string {
  return toTodayDate();
}
