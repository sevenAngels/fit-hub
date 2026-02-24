import type { ApiClientError } from "@/infrastructure/api/client";
import { supabase } from "@/infrastructure/supabase/client";

export type MoodType = "happy" | "neutral" | "sad" | "angry" | "stressed";

type DailyMoodRow = {
  id: string;
  record_date: string;
  emotion?: string | null;
  mood_status?: string | null;
  mood_type?: string | null;
  stress_level: number | null;
  sleep_hours: number | null;
  mood_note: string | null;
  updated_at: string | null;
};

export type DailyMoodEntry = {
  id: string;
  recordDate: string;
  moodType: MoodType;
  stressLevel: number;
  sleepHours: number | null;
  notes: string;
  updatedAt: string | null;
};

export type SaveDailyMoodInput = {
  recordDate: string;
  moodType: MoodType;
  stressLevel: number;
  sleepHours: number | null;
  notes: string;
};

const validMoodTypes: MoodType[] = ["happy", "neutral", "sad", "angry", "stressed"];

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

function toMoodType(raw: string | null | undefined): MoodType {
  if (!raw) {
    return "neutral";
  }

  const normalized = raw.trim().toLowerCase();
  if (validMoodTypes.includes(normalized as MoodType)) {
    return normalized as MoodType;
  }

  return "neutral";
}

function parseMoodRow(row: DailyMoodRow): DailyMoodEntry {
  const sourceMood = row.emotion ?? row.mood_status ?? row.mood_type ?? "neutral";

  return {
    id: row.id,
    recordDate: row.record_date,
    moodType: toMoodType(sourceMood),
    stressLevel: typeof row.stress_level === "number" ? row.stress_level : 3,
    sleepHours: typeof row.sleep_hours === "number" ? row.sleep_hours : null,
    notes: row.mood_note ?? "",
    updatedAt: row.updated_at
  };
}

function validateMoodPayload(input: SaveDailyMoodInput): void {
  if (!validMoodTypes.includes(input.moodType)) {
    throw toError("Select a valid mood type.", 400);
  }

  if (!Number.isFinite(input.stressLevel) || input.stressLevel < 1 || input.stressLevel > 5) {
    throw toError("Stress level must be between 1 and 5.", 400);
  }

  if (input.sleepHours !== null) {
    if (!Number.isFinite(input.sleepHours) || input.sleepHours < 0 || input.sleepHours > 24) {
      throw toError("Sleep hours must be between 0 and 24.", 400);
    }
  }

  if (input.notes.length > 500) {
    throw toError("Notes must be 500 characters or fewer.", 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.recordDate)) {
    throw toError("Record date must be YYYY-MM-DD.", 400);
  }
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

export async function getMoodByDate(recordDate: string): Promise<DailyMoodEntry | null> {
  const userId = await resolveUserIdOrError();

  const { data, error } = await supabase
    .from("daily_moods")
    .select("*")
    .eq("user_id", userId)
    .eq("record_date", recordDate)
    .maybeSingle();

  if (error) {
    throw toError(error.message || "Failed to load daily mood.", 500);
  }

  const row = data as DailyMoodRow | null;
  if (!row) {
    return null;
  }

  return parseMoodRow(row);
}

export async function saveDailyMood(input: SaveDailyMoodInput): Promise<DailyMoodEntry> {
  validateMoodPayload(input);
  const userId = await resolveUserIdOrError();

  const { data, error } = await supabase
    .from("daily_moods")
    .upsert(
      {
        user_id: userId,
        record_date: input.recordDate,
        emotion: input.moodType,
        stress_level: input.stressLevel,
        sleep_hours: input.sleepHours,
        mood_note: input.notes.trim(),
        motivation_need: "balanced"
      },
      {
        onConflict: "user_id,record_date"
      }
    )
    .select("*")
    .single();

  if (error) {
    throw toError(error.message || "Failed to save daily mood.", 500);
  }

  return parseMoodRow(data as DailyMoodRow);
}

export function getMoodTodayDate(): string {
  return toTodayDate();
}
