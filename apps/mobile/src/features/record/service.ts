import { ApiClientError } from "@/infrastructure/api/client";
import { supabase } from "@/infrastructure/supabase/client";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "night_snack" | "beverage";

export type MealRecordItem = {
  id: string;
  user_id: string;
  image_url: string | null;
  image_storage_path: string | null;
  food_name: string | null;
  food_name_en: string | null;
  meal_type: MealType;
  meal_time: string | null;
  record_date: string;
  created_at: string;
  updated_at: string;
  total_calories: number | null;
  total_carbohydrates_g: number | null;
  total_protein_g: number | null;
  total_fat_g: number | null;
  ai_review: string | null;
  ai_score: "perfect" | "good" | "bad" | null;
  analysis_confidence: number | null;
  user_note: string | null;
  is_manually_edited: boolean | null;
};

export type MealRecordListItem = Pick<
  MealRecordItem,
  "id" | "image_url" | "food_name" | "meal_type" | "record_date" | "created_at" | "total_calories" | "total_carbohydrates_g" | "total_protein_g" | "total_fat_g" | "user_note" | "ai_review" | "ai_score"
>;

export type UpdateMealRecordPayload = {
  totalCalories?: number | null;
  totalCarbohydratesG?: number | null;
  totalProteinG?: number | null;
  totalFatG?: number | null;
  userNote?: string | null;
};

type UpdateData = {
  is_manually_edited: boolean;
  total_calories?: number | null;
  total_carbohydrates_g?: number | null;
  total_protein_g?: number | null;
  total_fat_g?: number | null;
  user_note?: string | null;
};

function toError(message: string, status = 500): ApiClientError {
  return {
    status,
    code: "unknown",
    message
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

export async function getMealsByDate(date: string): Promise<MealRecordListItem[]> {
  const userId = await resolveUserIdOrError();

  const { data, error } = await supabase
    .from("meal_records")
    .select(
      "id, image_url, food_name, meal_type, record_date, created_at, total_calories, total_carbohydrates_g, total_protein_g, total_fat_g, user_note, ai_review, ai_score"
    )
    .eq("user_id", userId)
    .eq("record_date", date)
    .order("meal_type")
    .order("created_at", { ascending: false });

  if (error) {
    throw toError(error.message || "Failed to load meal history.", 500);
  }

  return (data as MealRecordListItem[]) ?? [];
}

export async function getMealById(mealId: string): Promise<MealRecordItem> {
  const userId = await resolveUserIdOrError();

  const { data, error } = await supabase
    .from("meal_records")
    .select("*")
    .eq("id", mealId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      throw toError("Meal record not found.", 404);
    }

    throw toError(error.message || "Failed to load meal record.", 500);
  }

  if (!data) {
    throw toError("Meal record not found.", 404);
  }

  return data as MealRecordItem;
}

export async function updateMealRecord(mealId: string, payload: UpdateMealRecordPayload): Promise<MealRecordItem> {
  const userId = await resolveUserIdOrError();

  const updateData: UpdateData = { is_manually_edited: true };

  if (payload.totalCalories !== undefined) {
    updateData.total_calories = payload.totalCalories;
  }
  if (payload.totalCarbohydratesG !== undefined) {
    updateData.total_carbohydrates_g = payload.totalCarbohydratesG;
  }
  if (payload.totalProteinG !== undefined) {
    updateData.total_protein_g = payload.totalProteinG;
  }
  if (payload.totalFatG !== undefined) {
    updateData.total_fat_g = payload.totalFatG;
  }
  if (payload.userNote !== undefined) {
    updateData.user_note = payload.userNote;
  }

  const { data, error } = await supabase
    .from("meal_records")
    .update(updateData)
    .eq("id", mealId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      throw toError("Meal record not found.", 404);
    }

    throw toError(error.message || "Failed to update meal record.", 500);
  }

  if (!data) {
    throw toError("Meal record not found.", 404);
  }

  return data as MealRecordItem;
}

export async function deleteMealRecord(mealId: string): Promise<{ recordDate: string; imagePath?: string | null }> {
  const userId = await resolveUserIdOrError();

  const { data: existing, error: fetchError } = await supabase
    .from("meal_records")
    .select("record_date, image_storage_path")
    .eq("id", mealId)
    .eq("user_id", userId)
    .single();

  if (fetchError) {
    if ((fetchError as { code?: string }).code === "PGRST116") {
      throw toError("Meal record not found.", 404);
    }

    throw toError(fetchError.message || "Failed to remove meal record.", 500);
  }

  if (!existing) {
    throw toError("Meal record not found.", 404);
  }

  const { error: deleteError } = await supabase
    .from("meal_records")
    .delete()
    .eq("id", mealId)
    .eq("user_id", userId);

  if (deleteError) {
    throw toError(deleteError.message || "Failed to delete meal record.", 500);
  }

  const imagePath = existing.image_storage_path;
  if (imagePath) {
    const { error: storageError } = await supabase.storage.from("meal-images").remove([imagePath]);
    if (storageError) {
      console.error("Failed to remove meal image from storage", storageError);
    }
  }

  return { recordDate: existing.record_date, imagePath };
}
