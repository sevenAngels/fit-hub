import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { type ApiClientError, mobileApiClient } from "@/infrastructure/api/client";
import { captureHandledError, trackUploadMetric } from "@/infrastructure/telemetry/client";

export type UploadSource = "camera" | "library";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "night_snack" | "beverage";

export type PickedMealImage = {
  uri: string;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
  fileSize: number | null;
};

export type MealUploadPayload = {
  mealType: MealType;
  date: string;
};

type MealUploadApiResponse = {
  success: boolean;
  data?: {
    mealId: string;
    imageUrl: string;
    createdAt?: string;
    analysis?: {
      summary?: {
        totalCalories?: number;
      };
      foodName?: string;
    };
  };
  warnings?: string[];
  error?: {
    message?: string;
  };
};

export type MealUploadResult = {
  mealId: string;
  imageUrl: string;
  createdAt: string | null;
  totalCalories: number | null;
  foodName: string | null;
  warnings: string[];
};

export type UploadMealImageOptions = {
  image: PickedMealImage;
  payload: MealUploadPayload;
  idempotencyKey: string;
  onProgress?: (progress: number) => void;
};

const PICKER_IMAGE_QUALITY = 0.82;
const MAX_UPLOAD_IMAGE_WIDTH = 1440;
const COMPRESS_IMAGE_QUALITY = 0.82;

async function askPermission(source: UploadSource): Promise<boolean> {
  if (source === "camera") {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    return camera.granted;
  }

  const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return media.granted;
}

export async function pickMealImage(source: UploadSource): Promise<PickedMealImage | null> {
  const granted = await askPermission(source);
  if (!granted) {
    throw new Error("Photo permission is required.");
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: PICKER_IMAGE_QUALITY,
          allowsEditing: false
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: PICKER_IMAGE_QUALITY,
          allowsEditing: false
        });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName ?? `meal-${Date.now()}.jpg`,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize ?? null
  };
}

export async function compressMealImage(image: PickedMealImage): Promise<PickedMealImage> {
  const manipulated = await ImageManipulator.manipulate(image.uri)
    .resize({ width: image.width > MAX_UPLOAD_IMAGE_WIDTH ? MAX_UPLOAD_IMAGE_WIDTH : image.width })
    .renderAsync();

  const result = await manipulated.saveAsync({
    compress: COMPRESS_IMAGE_QUALITY,
    format: SaveFormat.JPEG
  });

  return {
    ...image,
    uri: result.uri,
    mimeType: "image/jpeg",
    fileName: image.fileName.endsWith(".jpg") || image.fileName.endsWith(".jpeg") ? image.fileName : `${image.fileName}.jpg`
  };
}

async function createImageBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

function mapUploadError(error: unknown): ApiClientError {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "code" in error &&
    "message" in error
  ) {
    return error as ApiClientError;
  }

  return {
    status: 0,
    code: "unknown",
    message: "Upload failed unexpectedly."
  };
}

function normalizeUploadResponse(response: MealUploadApiResponse): MealUploadResult {
  if (!response.success || !response.data?.mealId || !response.data.imageUrl) {
    throw {
      status: 400,
      code: "unknown",
      message: response.error?.message ?? "Upload response is missing required fields."
    } satisfies ApiClientError;
  }

  return {
    mealId: response.data.mealId,
    imageUrl: response.data.imageUrl,
    createdAt: response.data.createdAt ?? null,
    totalCalories: response.data.analysis?.summary?.totalCalories ?? null,
    foodName: response.data.analysis?.foodName ?? null,
    warnings: response.warnings ?? []
  };
}

export function createMealUploadIdempotencyKey(date: string, mealType: MealType): string {
  return `meal-upload:${date}:${mealType}:${Date.now()}`;
}

export async function uploadMealImage(options: UploadMealImageOptions): Promise<MealUploadResult> {
  const startedAt = Date.now();
  const compressed = await compressMealImage(options.image);
  const imageBlob = await createImageBlob(compressed.uri);

  const formData = new FormData();
  formData.append("image", imageBlob, compressed.fileName);
  formData.append("mealType", options.payload.mealType);
  formData.append("date", options.payload.date);

  try {
    const response = await mobileApiClient.uploadMeal<MealUploadApiResponse>(
      formData,
      options.idempotencyKey,
      options.onProgress
    );
    const normalized = normalizeUploadResponse(response);

    trackUploadMetric({
      operation: "meal_upload",
      durationMs: Date.now() - startedAt,
      ok: true
    });

    return normalized;
  } catch (error) {
    const mappedError = mapUploadError(error);

    trackUploadMetric({
      operation: "meal_upload",
      durationMs: Date.now() - startedAt,
      ok: false,
      errorCode: mappedError.code
    });

    captureHandledError("record.upload", new Error(mappedError.message), {
      status: mappedError.status,
      code: mappedError.code
    });

    throw mappedError;
  }
}
