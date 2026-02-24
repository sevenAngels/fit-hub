import type { ApiClientError } from "@/infrastructure/api/client";
import { healthFlags } from "@/infrastructure/config/env";
import { supabase } from "@/infrastructure/supabase/client";
import { Platform } from "react-native";

type MealRow = {
  record_date: string;
  total_calories: number | null;
  total_carbohydrates_g: number | null;
  total_protein_g: number | null;
  total_fat_g: number | null;
};

type MoodRow = {
  emotion: string | null;
  mood_type?: string | null;
  mood_status?: string | null;
};

type WeightRow = {
  weight_kg: number | null;
  record_date: string;
};

type WeeklyReportRow = {
  id: string;
  week_start_date: string;
  week_end_date: string;
  total_meals_recorded: number | null;
  avg_daily_calories: number | null;
  avg_carbs_g: number | null;
  avg_protein_g: number | null;
  avg_fat_g: number | null;
  emotion_breakdown: unknown;
  streak_days: number | null;
  insights: unknown;
  recommendations: unknown;
  created_at: string | null;
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

export type WeeklyReportSummary = {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalMeals: number;
  avgDailyCalories: number;
  createdAt: string | null;
};

export type WeeklyReportDetail = {
  id: string | null;
  weekStartDate: string;
  weekEndDate: string;
  totalMeals: number;
  avgDailyCalories: number;
  totalCalories: number;
  avgCarbs: number;
  avgProtein: number;
  avgFat: number;
  moodSummary: Record<string, number>;
  weightChange: number | null;
  streakDays: number;
  highlights: string[];
  improvements: string[];
};

export type WeeklyReportHealthSummary = {
  weekStartDate: string;
  weekEndDate: string;
  enabled: boolean;
  hasData: boolean;
  totalSteps: number;
  totalActiveKcal: number;
  daysWithData: number;
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

function parseYmd(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw toError("Date must be YYYY-MM-DD.", 400);
  }
  return date;
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(baseYmd: string, days: number): string {
  const date = parseYmd(baseYmd);
  date.setUTCDate(date.getUTCDate() + days);
  return toYmd(date);
}

function toMondayDate(ymd: string): string {
  const date = parseYmd(ymd);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return toYmd(date);
}

function getCurrentWeekStartDate(): string {
  return toMondayDate(toTodayDate());
}

function getIsoWeekNumber(ymd: string): number {
  const date = parseYmd(ymd);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diff = date.getTime() - yearStart.getTime();
  return Math.ceil((diff / 86400000 + 1) / 7);
}

function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function disabledWeeklyHealthSummary(weekStartDate: string, weekEndDate: string): WeeklyReportHealthSummary {
  return {
    weekStartDate,
    weekEndDate,
    enabled: false,
    hasData: false,
    totalSteps: 0,
    totalActiveKcal: 0,
    daysWithData: 0,
    sourceCount: 0,
    lastSuccessAt: null,
    stale: false,
    isRunning: false,
    syncState: "disabled",
    errorMessage: null
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseMoodSummary(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const summary: Record<string, number> = {};

  for (const [key, raw] of entries) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      summary[key] = raw;
    }
  }

  return summary;
}

function toWeeklyReportSummary(row: WeeklyReportRow): WeeklyReportSummary {
  return {
    id: row.id,
    weekStartDate: row.week_start_date,
    weekEndDate: row.week_end_date,
    totalMeals: toNumber(row.total_meals_recorded),
    avgDailyCalories: toNumber(row.avg_daily_calories),
    createdAt: row.created_at
  };
}

function toWeeklyReportDetailFromRow(row: WeeklyReportRow): WeeklyReportDetail {
  return {
    id: row.id,
    weekStartDate: row.week_start_date,
    weekEndDate: row.week_end_date,
    totalMeals: toNumber(row.total_meals_recorded),
    avgDailyCalories: toNumber(row.avg_daily_calories),
    totalCalories: toNumber(row.avg_daily_calories) * Math.max(1, toNumber(row.streak_days)),
    avgCarbs: toNumber(row.avg_carbs_g),
    avgProtein: toNumber(row.avg_protein_g),
    avgFat: toNumber(row.avg_fat_g),
    moodSummary: parseMoodSummary(row.emotion_breakdown),
    weightChange: null,
    streakDays: toNumber(row.streak_days),
    highlights: parseStringArray(row.insights),
    improvements: parseStringArray(row.recommendations)
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

function buildHighlights(daysWithMeals: number, weightChange: number | null, moodSummary: Record<string, number>): string[] {
  const highlights: string[] = [];

  if (daysWithMeals >= 5) {
    highlights.push("Great consistency: you logged meals on 5+ days this week.");
  }

  if (weightChange !== null && weightChange < 0) {
    highlights.push(`Weight trend improved by ${Math.abs(weightChange).toFixed(1)}kg this week.`);
  }

  const goodMoods = (moodSummary.happy ?? 0) + (moodSummary.great ?? 0) + (moodSummary.good ?? 0);
  if (goodMoods >= 4) {
    highlights.push("Mood trend is positive this week.");
  }

  return highlights;
}

function buildImprovements(daysWithMeals: number, totalCalories: number): string[] {
  const improvements: string[] = [];

  if (daysWithMeals < 5) {
    improvements.push("Log meals daily for more accurate weekly analysis.");
  }

  if (daysWithMeals > 0 && totalCalories / daysWithMeals > 2500) {
    improvements.push("Average calories are high; consider a lighter daily target.");
  }

  if (improvements.length === 0) {
    improvements.push("No major issues detected this week.");
  }

  return improvements;
}

export async function generateWeeklyReport(weekStartDate = getCurrentWeekStartDate()): Promise<WeeklyReportDetail> {
  const userId = await resolveUserIdOrError();

  const normalizedStartDate = toMondayDate(weekStartDate);
  const endDate = addDays(normalizedStartDate, 6);

  const [mealsResult, moodsResult, weightsResult] = await Promise.all([
    supabase
      .from("meal_records")
      .select("record_date,total_calories,total_carbohydrates_g,total_protein_g,total_fat_g")
      .eq("user_id", userId)
      .gte("record_date", normalizedStartDate)
      .lte("record_date", endDate),
    supabase
      .from("daily_moods")
      .select("emotion,mood_type,mood_status")
      .eq("user_id", userId)
      .gte("record_date", normalizedStartDate)
      .lte("record_date", endDate),
    supabase
      .from("weight_logs")
      .select("weight_kg,record_date")
      .eq("user_id", userId)
      .gte("record_date", normalizedStartDate)
      .lte("record_date", endDate)
      .order("record_date", { ascending: true })
  ]);

  if (mealsResult.error || moodsResult.error || weightsResult.error) {
    throw toError(
      mealsResult.error?.message || moodsResult.error?.message || weightsResult.error?.message || "Failed to build weekly report.",
      500
    );
  }

  const meals = (mealsResult.data as MealRow[] | null) ?? [];
  const moods = (moodsResult.data as MoodRow[] | null) ?? [];
  const weights = (weightsResult.data as WeightRow[] | null) ?? [];

  const totalCalories = meals.reduce((sum, meal) => sum + toNumber(meal.total_calories), 0);
  const totalCarbs = meals.reduce((sum, meal) => sum + toNumber(meal.total_carbohydrates_g), 0);
  const totalProtein = meals.reduce((sum, meal) => sum + toNumber(meal.total_protein_g), 0);
  const totalFat = meals.reduce((sum, meal) => sum + toNumber(meal.total_fat_g), 0);

  const uniqueDates = new Set(meals.map((meal) => meal.record_date));
  const daysWithMeals = uniqueDates.size;

  const moodSummary: Record<string, number> = {};
  for (const mood of moods) {
    const key = mood.emotion ?? mood.mood_type ?? mood.mood_status;
    if (!key) {
      continue;
    }
    moodSummary[key] = (moodSummary[key] ?? 0) + 1;
  }

  let weightChange: number | null = null;
  if (weights.length >= 2) {
    const startWeight = weights[0].weight_kg;
    const endWeight = weights[weights.length - 1].weight_kg;
    if (typeof startWeight === "number" && typeof endWeight === "number") {
      weightChange = endWeight - startWeight;
    }
  }

  const detail: WeeklyReportDetail = {
    id: null,
    weekStartDate: normalizedStartDate,
    weekEndDate: endDate,
    totalMeals: meals.length,
    avgDailyCalories: daysWithMeals > 0 ? Math.round(totalCalories / daysWithMeals) : 0,
    totalCalories,
    avgCarbs: daysWithMeals > 0 ? Math.round(totalCarbs / daysWithMeals) : 0,
    avgProtein: daysWithMeals > 0 ? Math.round(totalProtein / daysWithMeals) : 0,
    avgFat: daysWithMeals > 0 ? Math.round(totalFat / daysWithMeals) : 0,
    moodSummary,
    weightChange,
    streakDays: daysWithMeals,
    highlights: buildHighlights(daysWithMeals, weightChange, moodSummary),
    improvements: buildImprovements(daysWithMeals, totalCalories)
  };

  const payload = {
    user_id: userId,
    week_start_date: detail.weekStartDate,
    week_end_date: detail.weekEndDate,
    year: Number(detail.weekStartDate.slice(0, 4)),
    week_number: getIsoWeekNumber(detail.weekStartDate),
    total_meals_recorded: detail.totalMeals,
    avg_daily_calories: detail.avgDailyCalories,
    avg_carbs_g: detail.avgCarbs,
    avg_protein_g: detail.avgProtein,
    avg_fat_g: detail.avgFat,
    emotion_breakdown: detail.moodSummary,
    streak_days: detail.streakDays,
    insights: detail.highlights,
    recommendations: detail.improvements
  };

  const { data: existingRows, error: existingError } = await supabase
    .from("weekly_reports")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start_date", detail.weekStartDate)
    .limit(1);

  if (existingError) {
    return detail;
  }

  if (existingRows && existingRows.length > 0) {
    const { data: updatedRow, error: updateError } = await supabase
      .from("weekly_reports")
      .update(payload)
      .eq("id", existingRows[0].id)
      .select("*")
      .single();

    if (updateError) {
      return detail;
    }

    return toWeeklyReportDetailFromRow(updatedRow as WeeklyReportRow);
  }

  const { data: insertedRow, error: insertError } = await supabase
    .from("weekly_reports")
    .insert(payload)
    .select("*")
    .single();

  if (insertError) {
    return detail;
  }

  return toWeeklyReportDetailFromRow(insertedRow as WeeklyReportRow);
}

export async function getWeeklyReports(limit = 12): Promise<WeeklyReportSummary[]> {
  const userId = await resolveUserIdOrError();

  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("user_id", userId)
    .order("week_start_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw toError(error.message || "Failed to load weekly reports.", 500);
  }

  const rows = (data as WeeklyReportRow[] | null) ?? [];
  return rows.map(toWeeklyReportSummary);
}

export async function getWeeklyReportByDate(weekStartDate: string): Promise<WeeklyReportDetail> {
  const userId = await resolveUserIdOrError();
  const normalized = toMondayDate(weekStartDate);

  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start_date", normalized)
    .maybeSingle();

  if (error) {
    throw toError(error.message || "Failed to load weekly report.", 500);
  }

  if (!data) {
    return generateWeeklyReport(normalized);
  }

  return toWeeklyReportDetailFromRow(data as WeeklyReportRow);
}

export async function getWeeklyReportHealthSummary(weekStartDate: string): Promise<WeeklyReportHealthSummary> {
  const normalizedStartDate = toMondayDate(weekStartDate);
  const endDate = addDays(normalizedStartDate, 6);

  const platform = resolveHealthPlatform();
  if (!isHealthEnabledForPlatform(platform)) {
    return disabledWeeklyHealthSummary(normalizedStartDate, endDate);
  }

  const userId = await resolveUserIdOrError();

  const [metricsResult, syncStateResult] = await Promise.all([
    supabase
      .from("health_daily_metrics")
      .select("local_date,steps,active_kcal,source,synced_at")
      .eq("user_id", userId)
      .eq("platform", platform)
      .gte("local_date", normalizedStartDate)
      .lte("local_date", endDate),
    supabase
      .from("health_sync_state")
      .select("last_success_at,is_running,error_message")
      .eq("user_id", userId)
      .eq("platform", platform)
      .in("record_type", ["steps", "activeCaloriesBurned"])
  ]);

  if (metricsResult.error || syncStateResult.error) {
    throw toError(metricsResult.error?.message || syncStateResult.error?.message || "Failed to load weekly health summary.", 500);
  }

  const metricRows = (metricsResult.data as HealthDailyMetricRow[] | null) ?? [];
  const syncRows = (syncStateResult.data as HealthSyncStateRow[] | null) ?? [];

  const totalSteps = metricRows.reduce((sum, row) => sum + toNumber(row.steps), 0);
  const totalActiveKcal = Number(metricRows.reduce((sum, row) => sum + toNumber(row.active_kcal), 0).toFixed(2));
  const daysWithData = new Set(metricRows.map((row) => row.local_date)).size;
  const sourceCount = new Set(
    metricRows.map((row) => row.source).filter((source): source is string => typeof source === "string" && source.length > 0)
  ).size;
  const isRunning = syncRows.some((row) => row.is_running === true);
  const errorMessage =
    syncRows.map((row) => row.error_message).find((value): value is string => typeof value === "string" && value.length > 0) ?? null;

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
  const syncState: WeeklyReportHealthSummary["syncState"] = !hasData && !lastSuccessAt
    ? "reconnect_required"
    : stale
      ? "stale"
      : errorMessage && !hasData
        ? "reconnect_required"
        : "connected";

  return {
    weekStartDate: normalizedStartDate,
    weekEndDate: endDate,
    enabled: true,
    hasData,
    totalSteps,
    totalActiveKcal,
    daysWithData,
    sourceCount,
    lastSuccessAt,
    stale,
    isRunning,
    syncState,
    errorMessage
  };
}

export function getCurrentReportWeekStartDate(): string {
  return getCurrentWeekStartDate();
}
