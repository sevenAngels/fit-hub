import { ApiRouteError } from "@/src/lib/http";

const mealMimeSet = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif"
]);

const avatarMimeSet = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif"
]);

const mimeToExt: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif"
};

export function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  const box = buffer.toString("ascii", 4, 12);
  if (box === "ftypheic" || box === "ftypheix" || box === "ftyphevc" || box === "ftyphevx") {
    return "image/heic";
  }

  if (box === "ftypmif1" || box === "ftypmsf1") {
    return "image/heif";
  }

  return null;
}

export function normalizeImageMime(buffer: Buffer, declaredMime: string | undefined): string {
  const detected = detectImageMime(buffer);
  if (detected) {
    return detected;
  }

  if (declaredMime && (mealMimeSet.has(declaredMime) || avatarMimeSet.has(declaredMime))) {
    return declaredMime;
  }

  throw new ApiRouteError(400, "INVALID_IMAGE_TYPE", "Unsupported image format.");
}

export function assertMealMime(mimeType: string) {
  if (!mealMimeSet.has(mimeType)) {
    throw new ApiRouteError(400, "INVALID_IMAGE_TYPE", "Meal image type is not allowed.");
  }
}

export function assertAvatarMime(mimeType: string) {
  if (!avatarMimeSet.has(mimeType)) {
    throw new ApiRouteError(400, "INVALID_IMAGE_TYPE", "Avatar image type is not allowed.");
  }
}

export function extensionForMime(mimeType: string) {
  return mimeToExt[mimeType] ?? "jpg";
}
