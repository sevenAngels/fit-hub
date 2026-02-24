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
      .from("subscriptions")
      .select("id,plan,status,auto_renew,current_period_end,next_billing_date,price_monthly,card_company,card_number")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      return fail(500, "DB_ERROR", error.message || "Failed to load subscription status.");
    }

    const row = data?.[0] ?? null;
    return ok(row);
  } catch (error) {
    const mapped = toApiError(error);
    return fail(mapped.status, mapped.code, mapped.message);
  }
}
