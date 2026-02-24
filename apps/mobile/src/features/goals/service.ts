import type { ApiClientError } from "@/infrastructure/api/client";
import { supabase } from "@/infrastructure/supabase/client";

export type ProgramGoal = "diet" | "bulk";

type GoalRow = {
  id: string;
  title: string | null;
  description: string | null;
  goal_type: string;
  status: string;
  current_value: number | null;
  target_value: number | null;
};

type ProfileRow = {
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  target_calories: number | null;
};

type HabitLogRow = {
  goal_id: string;
};

export type WeightGoalData = {
  currentWeight: number;
  targetWeight: number;
  targetCalories: number;
  programGoal: ProgramGoal;
};

export type HabitGoalItem = {
  id: string;
  title: string;
  isCompleted: boolean;
};

export type SaveWeightGoalInput = {
  currentWeight: number;
  targetWeight: number;
  programGoal: ProgramGoal;
};

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

function parseProgramGoal(value: unknown): ProgramGoal | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "bulk") {
    return "bulk";
  }

  if (normalized === "diet") {
    return "diet";
  }

  return null;
}

function inferProgramGoal(currentWeight: number, targetWeight: number): ProgramGoal {
  if (targetWeight > currentWeight) {
    return "bulk";
  }

  return "diet";
}

function getWeightDirectionValidationMessage(programGoal: ProgramGoal, currentWeight: number, targetWeight: number): string | null {
  if (programGoal === "bulk" && targetWeight <= currentWeight) {
    return "For bulk, target weight must be higher than current weight.";
  }

  if (programGoal === "diet" && targetWeight >= currentWeight) {
    return "For diet, target weight must be lower than current weight.";
  }

  return null;
}

function getWeightGoalTitle(programGoal: ProgramGoal): string {
  return programGoal === "bulk" ? "Weight gain" : "Weight loss";
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

async function upsertProgramGoalSelection(userId: string, programGoal: ProgramGoal): Promise<void> {
  const { data: existingGoals, error: existingGoalsError } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", userId)
    .eq("goal_type", "program")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (existingGoalsError) {
    throw toError(existingGoalsError.message || "Failed to load program goal.");
  }

  if (existingGoals && existingGoals.length > 0) {
    const { error: updateError } = await supabase
      .from("goals")
      .update({
        title: getWeightGoalTitle(programGoal),
        description: programGoal,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingGoals[0].id);

    if (updateError) {
      throw toError(updateError.message || "Failed to update program goal.");
    }
    return;
  }

  const { error: insertError } = await supabase.from("goals").insert({
    user_id: userId,
    goal_type: "program",
    title: getWeightGoalTitle(programGoal),
    description: programGoal,
    status: "active",
    current_value: null,
    target_value: null,
    start_date: new Date().toISOString()
  });

  if (insertError) {
    throw toError(insertError.message || "Failed to create program goal.");
  }
}

export async function getWeightGoalData(): Promise<WeightGoalData> {
  const userId = await resolveUserIdOrError();

  const [profileResult, programGoalResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("current_weight_kg,target_weight_kg,target_calories")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("title,description")
      .eq("user_id", userId)
      .eq("goal_type", "program")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
  ]);

  if (profileResult.error) {
    throw toError(profileResult.error.message || "Failed to load profile goals.");
  }
  if (programGoalResult.error) {
    throw toError(programGoalResult.error.message || "Failed to load program goals.");
  }

  const profile = (profileResult.data as ProfileRow | null) ?? null;
  const programRow = programGoalResult.data?.[0] as { title?: string | null; description?: string | null } | undefined;

  const currentWeight = typeof profile?.current_weight_kg === "number" ? profile.current_weight_kg : 65;
  const targetWeight = typeof profile?.target_weight_kg === "number" ? profile.target_weight_kg : 58;
  const targetCalories = typeof profile?.target_calories === "number" ? profile.target_calories : 1800;

  const explicitProgramGoal = parseProgramGoal(programRow?.description) ?? parseProgramGoal(programRow?.title);

  return {
    currentWeight,
    targetWeight,
    targetCalories,
    programGoal: explicitProgramGoal ?? inferProgramGoal(currentWeight, targetWeight)
  };
}

export async function saveWeightGoal(input: SaveWeightGoalInput): Promise<void> {
  const userId = await resolveUserIdOrError();

  if (!Number.isFinite(input.currentWeight) || input.currentWeight < 30 || input.currentWeight > 300) {
    throw toError("Current weight must be in range 30-300 kg.", 400);
  }

  if (!Number.isFinite(input.targetWeight) || input.targetWeight < 30 || input.targetWeight > 300) {
    throw toError("Target weight must be in range 30-300 kg.", 400);
  }

  const directionValidationMessage = getWeightDirectionValidationMessage(
    input.programGoal,
    input.currentWeight,
    input.targetWeight
  );

  if (directionValidationMessage) {
    throw toError(directionValidationMessage, 400);
  }

  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({
      current_weight_kg: input.currentWeight,
      target_weight_kg: input.targetWeight
    })
    .eq("user_id", userId);

  if (profileError) {
    throw toError(profileError.message || "Failed to update profile goal.");
  }

  const today = toTodayDate();
  const { error: weightLogError } = await supabase.from("weight_logs").upsert(
    {
      user_id: userId,
      weight_kg: input.currentWeight,
      record_date: today
    },
    { onConflict: "user_id,record_date" }
  );

  if (weightLogError) {
    throw toError(weightLogError.message || "Failed to store weight log.");
  }

  const { data: existingWeightGoals, error: existingWeightGoalsError } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", userId)
    .eq("goal_type", "weight")
    .eq("status", "active")
    .limit(1);

  if (existingWeightGoalsError) {
    throw toError(existingWeightGoalsError.message || "Failed to load weight goals.");
  }

  const weightGoalTitle = getWeightGoalTitle(input.programGoal);
  if (existingWeightGoals && existingWeightGoals.length > 0) {
    const { error: updateError } = await supabase
      .from("goals")
      .update({
        title: weightGoalTitle,
        current_value: input.currentWeight,
        target_value: input.targetWeight,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingWeightGoals[0].id);

    if (updateError) {
      throw toError(updateError.message || "Failed to update weight goal.");
    }
  } else {
    const { error: insertError } = await supabase.from("goals").insert({
      user_id: userId,
      goal_type: "weight",
      title: weightGoalTitle,
      current_value: input.currentWeight,
      target_value: input.targetWeight,
      start_date: new Date().toISOString(),
      unit: "kg",
      status: "active"
    });

    if (insertError) {
      throw toError(insertError.message || "Failed to create weight goal.");
    }
  }

  await upsertProgramGoalSelection(userId, input.programGoal);
}

export async function saveCalorieGoal(targetCalories: number): Promise<void> {
  const userId = await resolveUserIdOrError();

  if (!Number.isFinite(targetCalories) || targetCalories < 600 || targetCalories > 6000) {
    throw toError("Target calories must be in range 600-6000 kcal.", 400);
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ target_calories: targetCalories })
    .eq("user_id", userId);

  if (error) {
    throw toError(error.message || "Failed to save target calories.");
  }
}

export async function getHabitGoals(date = toTodayDate()): Promise<HabitGoalItem[]> {
  const userId = await resolveUserIdOrError();

  const { data: habits, error: habitsError } = await supabase
    .from("goals")
    .select("id,title")
    .eq("user_id", userId)
    .eq("goal_type", "habit")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (habitsError) {
    throw toError(habitsError.message || "Failed to load habits.");
  }

  const habitRows = (habits as { id: string; title: string | null }[] | null) ?? [];
  if (habitRows.length === 0) {
    return [];
  }

  const habitIds = habitRows.map((habit) => habit.id);
  const { data: habitLogs, error: logsError } = await supabase
    .from("habit_logs")
    .select("goal_id")
    .eq("user_id", userId)
    .eq("completed_date", date)
    .in("goal_id", habitIds);

  if (logsError) {
    throw toError(logsError.message || "Failed to load habit completion logs.");
  }

  const logRows = (habitLogs as HabitLogRow[] | null) ?? [];
  const completedSet = new Set(logRows.map((log) => log.goal_id));

  return habitRows.map((habit) => ({
    id: habit.id,
    title: habit.title ?? "Habit",
    isCompleted: completedSet.has(habit.id)
  }));
}

export async function addHabitGoal(title: string): Promise<void> {
  const userId = await resolveUserIdOrError();
  const trimmed = title.trim();

  if (!trimmed) {
    throw toError("Habit title is required.", 400);
  }

  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    goal_type: "habit",
    title: trimmed,
    is_daily_habit: true,
    status: "active",
    current_value: 0,
    target_value: 1,
    start_date: new Date().toISOString()
  });

  if (error) {
    throw toError(error.message || "Failed to add habit.");
  }
}

export async function toggleHabitCompletion(goalId: string, isCompleted: boolean, date = toTodayDate()): Promise<void> {
  const userId = await resolveUserIdOrError();

  if (isCompleted) {
    const { error } = await supabase.from("habit_logs").upsert(
      {
        user_id: userId,
        goal_id: goalId,
        completed_date: date,
        completed_at: new Date().toISOString()
      },
      { onConflict: "goal_id,completed_date" }
    );

    if (error) {
      throw toError(error.message || "Failed to mark habit complete.");
    }
    return;
  }

  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("user_id", userId)
    .eq("goal_id", goalId)
    .eq("completed_date", date);

  if (error) {
    throw toError(error.message || "Failed to mark habit incomplete.");
  }
}

export function getGoalsTodayDate(): string {
  return toTodayDate();
}

export type { GoalRow };
