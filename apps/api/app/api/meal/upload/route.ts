import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getEnv } from "@/src/lib/env";
import { analyzeMealImage, type MealAnalysisResult } from "@/src/lib/gemini";
import { ApiRouteError, fail, isYmd, randomSuffix, toApiError } from "@/src/lib/http";
import { assertMealMime, extensionForMime, normalizeImageMime } from "@/src/lib/image";
import { getAdminClient, requireUser } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack", "night_snack", "beverage"]);

const fallbackAnalysis: MealAnalysisResult = {
  isFood: true,
  foodName: "음식",
  foodNameEn: "Food",
  totalCalories: 0,
  totalCarbohydratesG: 0,
  totalProteinG: 0,
  totalFatG: 0,
  aiReview: "AI 분석이 일시적으로 지연되어 기본값으로 저장되었습니다.",
  aiScore: "good" as "good" | "perfect" | "bad",
  confidence: 0
};

export async function POST(request: NextRequest) {
  try {
    const env = getEnv();
    const admin = getAdminClient();
    const user = await requireUser(request);

    const formData = await request.formData();
    const image = formData.get("image");
    const mealTypeRaw = formData.get("mealType");
    const dateRaw = formData.get("date");

    if (!(image instanceof File)) {
      throw new ApiRouteError(400, "INVALID_REQUEST", "Image file is required.");
    }

    if (typeof mealTypeRaw !== "string" || typeof dateRaw !== "string") {
      throw new ApiRouteError(400, "INVALID_REQUEST", "mealType and date are required.");
    }

    const mealType = mealTypeSchema.parse(mealTypeRaw);

    if (!isYmd(dateRaw)) {
      throw new ApiRouteError(400, "INVALID_DATE", "Date must be YYYY-MM-DD.");
    }

    if (image.size <= 0 || image.size > env.MEAL_IMAGE_MAX_BYTES) {
      throw new ApiRouteError(413, "IMAGE_TOO_LARGE", "Meal image size is too large.");
    }

    const raw = Buffer.from(await image.arrayBuffer());
    const mimeType = normalizeImageMime(raw, image.type || undefined);
    assertMealMime(mimeType);

    const filePath = `${user.id}/${dateRaw}/${mealType}_${Date.now()}_${randomSuffix(8)}.${extensionForMime(mimeType)}`;

    const { error: uploadError } = await admin.storage
      .from("meal-images")
      .upload(filePath, raw, {
        contentType: mimeType,
        cacheControl: "31536000",
        upsert: false
      });

    if (uploadError) {
      throw new ApiRouteError(500, "UPLOAD_FAILED", uploadError.message || "Image upload failed.");
    }

    const {
      data: { publicUrl }
    } = admin.storage.from("meal-images").getPublicUrl(filePath);

    const warnings: string[] = [];
    let analysis: MealAnalysisResult = fallbackAnalysis;

    if (raw.byteLength <= env.GEMINI_MEAL_IMAGE_INLINE_BYTES) {
      try {
        analysis = await analyzeMealImage({
          mealType,
          mimeType,
          base64Image: raw.toString("base64")
        });
      } catch {
        warnings.push("Gemini analysis failed. Saved with fallback nutrition.");
      }
    } else {
      warnings.push("Image was too large for inline Gemini analysis. Saved with fallback nutrition.");
    }

    if (!analysis.isFood) {
      await admin.storage.from("meal-images").remove([filePath]);
      return fail(400, "NOT_FOOD_IMAGE", "Food image was not detected.");
    }

    const insertPayload = {
      user_id: user.id,
      record_date: dateRaw,
      meal_type: mealType,
      image_url: publicUrl,
      image_storage_path: filePath,
      total_calories: analysis.totalCalories,
      total_carbohydrates_g: analysis.totalCarbohydratesG,
      total_protein_g: analysis.totalProteinG,
      total_fat_g: analysis.totalFatG,
      food_name: analysis.foodName,
      food_name_en: analysis.foodNameEn,
      ai_review: analysis.aiReview,
      ai_score: analysis.aiScore,
      analysis_confidence: analysis.confidence,
      updated_at: new Date().toISOString()
    };

    const { data: mealRecord, error: insertError } = await admin
      .from("meal_records")
      .insert(insertPayload)
      .select("id,created_at")
      .single();

    if (insertError || !mealRecord) {
      await admin.storage.from("meal-images").remove([filePath]);
      throw new ApiRouteError(500, "DB_ERROR", insertError?.message || "Failed to save meal record.");
    }

    return NextResponse.json({
      success: true,
      data: {
        mealId: mealRecord.id,
        imageUrl: publicUrl,
        createdAt: mealRecord.created_at ?? null,
        analysis: {
          summary: {
            totalCalories: analysis.totalCalories
          },
          foodName: analysis.foodName
        }
      },
      warnings
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(400, "INVALID_REQUEST", error.issues[0]?.message ?? "Invalid request.");
    }

    const mapped = toApiError(error);
    return fail(mapped.status, mapped.code, mapped.message);
  }
}
