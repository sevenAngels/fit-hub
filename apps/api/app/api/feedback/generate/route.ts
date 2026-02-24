import { NextRequest } from "next/server";
import { z } from "zod";

import { todayYmd } from "@/src/lib/date";
import { generateFeedback } from "@/src/lib/gemini";
import { ApiRouteError, fail, ok, toApiError } from "@/src/lib/http";
import { getAdminClient, requireUser } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 15;

const requestSchema = z
  .object({
    nickname: z.string().optional(),
    programGoal: z.string().optional(),
    totalCalories: z.number().optional(),
    totalProtein: z.number().optional(),
    totalCarbs: z.number().optional(),
    totalFat: z.number().optional(),
    targetCalories: z.number().optional()
  })
  .partial();

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const user = await requireUser(request);

    const rawBody = await request.json().catch(() => ({}));
    const payload = requestSchema.parse(rawBody);
    const date = todayYmd();

    let totals = {
      totalCalories: asNumber(payload.totalCalories),
      totalProtein: asNumber(payload.totalProtein),
      totalCarbs: asNumber(payload.totalCarbs),
      totalFat: asNumber(payload.totalFat)
    };

    if (totals.totalCalories === 0 && totals.totalProtein === 0 && totals.totalCarbs === 0 && totals.totalFat === 0) {
      const { data: meals, error: mealError } = await admin
        .from("meal_records")
        .select("total_calories,total_protein_g,total_carbohydrates_g,total_fat_g")
        .eq("user_id", user.id)
        .eq("record_date", date);

      if (mealError) {
        throw new ApiRouteError(500, "DB_ERROR", mealError.message || "Failed to load meal summary.");
      }

      totals = {
        totalCalories: (meals ?? []).reduce((sum, item) => sum + asNumber(item.total_calories), 0),
        totalProtein: (meals ?? []).reduce((sum, item) => sum + asNumber(item.total_protein_g), 0),
        totalCarbs: (meals ?? []).reduce((sum, item) => sum + asNumber(item.total_carbohydrates_g), 0),
        totalFat: (meals ?? []).reduce((sum, item) => sum + asNumber(item.total_fat_g), 0)
      };
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("nickname,target_calories")
      .eq("user_id", user.id)
      .maybeSingle();

    const feedback = await generateFeedback({
      nickname: payload.nickname ?? profile?.nickname ?? "user",
      programGoal: payload.programGoal ?? "diet",
      totalCalories: totals.totalCalories,
      totalProtein: totals.totalProtein,
      totalCarbs: totals.totalCarbs,
      totalFat: totals.totalFat,
      targetCalories: asNumber(payload.targetCalories) || asNumber(profile?.target_calories) || 1800
    });

    const { data: inserted } = await admin
      .from("ai_feedbacks")
      .insert({
        user_id: user.id,
        feedback_date: date,
        feedback_text: feedback.feedbackText,
        nutrition_summary: {
          totalCalories: totals.totalCalories,
          totalProtein: totals.totalProtein,
          totalCarbs: totals.totalCarbs,
          totalFat: totals.totalFat
        },
        ai_provider: "gemini",
        ai_model: "gemini"
      })
      .select("id,created_at")
      .maybeSingle();

    return ok({
      id: inserted?.id ?? null,
      feedbackText: feedback.feedbackText,
      highlights: feedback.highlights,
      suggestions: feedback.suggestions,
      createdAt: inserted?.created_at ?? new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(400, "INVALID_REQUEST", error.issues[0]?.message ?? "Invalid request.");
    }

    const mapped = toApiError(error);
    return fail(mapped.status, mapped.code, mapped.message);
  }
}
