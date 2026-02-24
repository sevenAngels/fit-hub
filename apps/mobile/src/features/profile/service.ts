import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { ApiClientError } from "@/infrastructure/api/client";
import { mobileApiClient } from "@/infrastructure/api/client";
import { supabase } from "@/infrastructure/supabase/client";

const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 6;
const MBTI_VALUES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP"
] as const;

const MAX_AVATAR_SIZE_MB = 10;
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;
const PICKER_IMAGE_QUALITY = 0.82;
const MAX_AVATAR_WIDTH = 1024;
const COMPRESS_AVATAR_QUALITY = 0.78;
const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif"
];

type ProfileRow = {
  user_id: string;
  nickname: string | null;
  mbti: string | null;
  avatar_url: string | null;
  updated_at: string | null;
};

type AvatarUploadApiResponse = {
  success: boolean;
  data?: {
    avatar_url?: string;
  };
  error?: string;
};

export type UserProfileData = {
  userId: string;
  email: string;
  nickname: string;
  mbti: string;
  avatarUrl: string | null;
  updatedAt: string | null;
};

export type UpdateProfileInput = {
  nickname: string;
  mbti: string;
};

export type PickedAvatarImage = {
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize: number | null;
  width: number;
  height: number;
};

function toError(message: string, status = 500): ApiClientError {
  return {
    status,
    code: "unknown",
    message
  };
}

function normalizeNickname(value: string): string {
  return value.trim();
}

function normalizeMbti(value: string): string {
  return value.trim().toUpperCase();
}

function validateNickname(value: string): string | null {
  const normalized = normalizeNickname(value);

  if (normalized.length < NICKNAME_MIN_LENGTH) {
    return `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters.`;
  }

  if (normalized.length > NICKNAME_MAX_LENGTH) {
    return `Nickname must be ${NICKNAME_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

function validateMbti(value: string): string | null {
  if (!value) {
    return null;
  }

  if (!MBTI_VALUES.includes(value as typeof MBTI_VALUES[number])) {
    return "Select a valid MBTI value.";
  }

  return null;
}

function validateAvatarImage(image: PickedAvatarImage): void {
  if (image.fileSize !== null && image.fileSize > MAX_AVATAR_SIZE_BYTES) {
    throw toError(`Image size must be ${MAX_AVATAR_SIZE_MB}MB or smaller.`, 400);
  }

  if (image.mimeType && !ALLOWED_AVATAR_TYPES.includes(image.mimeType)) {
    throw toError("Only JPG, PNG, WebP, GIF, HEIC, and HEIF images are supported.", 400);
  }
}

function mapUploadApiError(error: unknown): ApiClientError {
  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeApiError = error as ApiClientError;
    if (typeof maybeApiError.message === "string") {
      return maybeApiError;
    }
  }

  return toError("Avatar upload failed unexpectedly.", 500);
}

async function resolveUserOrError(): Promise<{ id: string; email: string }> {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    throw toError("Authentication required.", 401);
  }

  return {
    id: session.user.id,
    email: session.user.email ?? ""
  };
}

async function createImageBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

async function optimizeAvatarImage(image: PickedAvatarImage): Promise<PickedAvatarImage> {
  const context = ImageManipulator.manipulate(image.uri);
  const manipulated = await (
    image.width > MAX_AVATAR_WIDTH ? context.resize({ width: MAX_AVATAR_WIDTH }) : context
  ).renderAsync();

  const result = await manipulated.saveAsync({
    compress: COMPRESS_AVATAR_QUALITY,
    format: SaveFormat.JPEG
  });

  return {
    ...image,
    uri: result.uri,
    mimeType: "image/jpeg",
    fileName: image.fileName.endsWith(".jpg") || image.fileName.endsWith(".jpeg") ? image.fileName : `${image.fileName}.jpg`,
    fileSize: null
  };
}

export async function getUserProfile(): Promise<UserProfileData> {
  const user = await resolveUserOrError();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw toError(error.message || "Failed to load profile.", 500);
  }

  const row = data as ProfileRow | null;

  return {
    userId: user.id,
    email: user.email,
    nickname: row?.nickname ?? "",
    mbti: row?.mbti ?? "",
    avatarUrl: row?.avatar_url ?? null,
    updatedAt: row?.updated_at ?? null
  };
}

export async function updateUserProfile(input: UpdateProfileInput): Promise<void> {
  const user = await resolveUserOrError();
  const nickname = normalizeNickname(input.nickname);
  const mbti = normalizeMbti(input.mbti);

  const nicknameError = validateNickname(nickname);
  if (nicknameError) {
    throw toError(nicknameError, 400);
  }

  const mbtiError = validateMbti(mbti);
  if (mbtiError) {
    throw toError(mbtiError, 400);
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({
      nickname,
      mbti: mbti || null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

  if (error) {
    throw toError(error.message || "Failed to update profile.", 500);
  }
}

export async function pickAvatarImage(): Promise<PickedAvatarImage | null> {
  const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!media.granted) {
    throw toError("Photo library permission is required.", 400);
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: PICKER_IMAGE_QUALITY
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName ?? `avatar-${Date.now()}.jpg`,
    fileSize: asset.fileSize ?? null,
    width: asset.width,
    height: asset.height
  };
}

export async function uploadProfileAvatar(image: PickedAvatarImage): Promise<{ avatarUrl: string }> {
  validateAvatarImage(image);

  const optimized = await optimizeAvatarImage(image);
  const imageBlob = await createImageBlob(optimized.uri);
  const formData = new FormData();
  formData.append("avatar", imageBlob, optimized.fileName);

  try {
    const response = await mobileApiClient.uploadAvatar<AvatarUploadApiResponse>(formData);

    if (!response.success || !response.data?.avatar_url) {
      throw toError(response.error || "Avatar upload failed.", 400);
    }

    return {
      avatarUrl: response.data.avatar_url
    };
  } catch (error) {
    throw mapUploadApiError(error);
  }
}
