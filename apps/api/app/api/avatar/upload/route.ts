import { NextRequest } from "next/server";

import { getEnv } from "@/src/lib/env";
import { ApiRouteError, fail, ok, randomSuffix, toApiError } from "@/src/lib/http";
import { assertAvatarMime, extensionForMime, normalizeImageMime } from "@/src/lib/image";
import { getAdminClient, requireUser } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(request: NextRequest) {
  try {
    const env = getEnv();
    const admin = getAdminClient();
    const user = await requireUser(request);

    const formData = await request.formData();
    const avatar = formData.get("avatar");

    if (!(avatar instanceof File)) {
      throw new ApiRouteError(400, "INVALID_REQUEST", "Avatar file is required.");
    }

    if (avatar.size <= 0 || avatar.size > env.AVATAR_IMAGE_MAX_BYTES) {
      throw new ApiRouteError(413, "IMAGE_TOO_LARGE", "Avatar image size is too large.");
    }

    const raw = Buffer.from(await avatar.arrayBuffer());
    const mimeType = normalizeImageMime(raw, avatar.type || undefined);
    assertAvatarMime(mimeType);

    const path = `${user.id}/${Date.now()}_${randomSuffix(8)}.${extensionForMime(mimeType)}`;

    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(path, raw, {
        contentType: mimeType,
        cacheControl: "31536000",
        upsert: true
      });

    if (uploadError) {
      throw new ApiRouteError(500, "UPLOAD_FAILED", uploadError.message || "Avatar upload failed.");
    }

    const {
      data: { publicUrl }
    } = admin.storage.from("avatars").getPublicUrl(path);

    const { error: profileError } = await admin
      .from("user_profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (profileError) {
      await admin.storage.from("avatars").remove([path]);
      throw new ApiRouteError(500, "DB_ERROR", profileError.message || "Profile update failed.");
    }

    return ok({
      avatar_url: publicUrl
    });
  } catch (error) {
    const mapped = toApiError(error);
    return fail(mapped.status, mapped.code, mapped.message);
  }
}
