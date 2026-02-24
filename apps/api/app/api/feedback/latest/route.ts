import { NextRequest } from "next/server";

import { fail, ok, toApiError } from "@/src/lib/http";
import { getAdminClient, requireUser } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const user = await requireUser(request);

    const { data, error } = await admin
      .from("ai_feedbacks")
      .select("id,feedback_text,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return fail(500, "DB_ERROR", error.message || "Failed to load latest feedback.");
    }

    const row = data?.[0] ?? null;

    if (!row) {
      return ok(null);
    }

    return ok({
      id: row.id,
      feedbackText: row.feedback_text,
      createdAt: row.created_at
    });
  } catch (error) {
    const mapped = toApiError(error);
    return fail(mapped.status, mapped.code, mapped.message);
  }
}
