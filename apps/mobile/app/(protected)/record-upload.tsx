import { useState } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { dashboardQueryKeys } from "@/features/dashboard/queries";
import { mealQueryKeys } from "@/features/record/queries";
import {
  createMealUploadIdempotencyKey,
  pickMealImage,
  type MealType,
  type PickedMealImage,
  type UploadSource,
  uploadMealImage
} from "@/features/record/upload-adapter";

type UploadRequest = {
  image: PickedMealImage;
  mealType: MealType;
  date: string;
  idempotencyKey: string;
};

type UploadResult = {
  mealId: string;
  imageUrl: string;
  createdAt: string | null;
  totalCalories: number | null;
  foodName: string | null;
};

const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack", "night_snack", "beverage"];

function toTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RecordUploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(toTodayDate());
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [selectedImage, setSelectedImage] = useState<PickedMealImage | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastRequest, setLastRequest] = useState<UploadRequest | null>(null);
  const [lastResult, setLastResult] = useState<UploadResult | null>(null);

  const pickImage = async (source: UploadSource) => {
    setError("");
    setSuccess("");

    try {
      const image = await pickMealImage(source);
      if (!image) {
        return;
      }
      setSelectedImage(image);
      setLastResult(null);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : "Could not pick image.");
    }
  };

  const runUpload = async (request: UploadRequest) => {
    setIsUploading(true);
    setProgress(0);
    setError("");
    setSuccess("");

    try {
      const result = await uploadMealImage({
        image: request.image,
        payload: {
          mealType: request.mealType,
          date: request.date
        },
        idempotencyKey: request.idempotencyKey,
        onProgress: setProgress
      });

      const summaryParts = [
        `Upload complete (mealId: ${result.mealId})`,
        result.totalCalories !== null ? `${result.totalCalories} kcal` : null,
        result.foodName ? `food: ${result.foodName}` : null
      ].filter(Boolean);

      setSuccess(summaryParts.join(" | "));
      setLastResult(result);

      void queryClient.invalidateQueries({ queryKey: mealQueryKeys.byDate(request.date) });
      void queryClient.invalidateQueries({ queryKey: mealQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: mealQueryKeys.detail(result.mealId) });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.nutrition(request.date) });
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        setError(uploadError.message);
      } else if (
        typeof uploadError === "object" &&
        uploadError !== null &&
        "message" in uploadError &&
        typeof uploadError.message === "string"
      ) {
        setError(uploadError.message);
      } else {
        setError("Upload failed. Please retry.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const startUpload = async () => {
    if (!selectedImage) {
      setError("Select an image first.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Date must be in YYYY-MM-DD format.");
      return;
    }

    const request: UploadRequest = {
      image: selectedImage,
      mealType,
      date,
      idempotencyKey: createMealUploadIdempotencyKey(date, mealType)
    };

    setLastRequest(request);
    await runUpload(request);
  };

  const openHistory = () => {
    router.push({ pathname: "/(protected)/record-history", params: { date } });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Upload</Text>
      <Text style={styles.subtitle}>Pick image, upload with progress, and retry on failure.</Text>

      <View style={styles.row}>
        <Pressable style={styles.secondaryButton} onPress={() => void pickImage("camera")} disabled={isUploading}>
          <Text style={styles.secondaryLabel}>Camera</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void pickImage("library")} disabled={isUploading}>
          <Text style={styles.secondaryLabel}>Gallery</Text>
        </Pressable>
      </View>

      {selectedImage ? <Image source={{ uri: selectedImage.uri }} style={styles.preview} /> : null}

      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        autoCapitalize="none"
        placeholder="YYYY-MM-DD"
        editable={!isUploading}
      />

      <View style={styles.mealTypeWrap}>
        {mealTypes.map((item) => (
          <Pressable
            key={item}
            style={[styles.chip, mealType === item ? styles.chipActive : null]}
            onPress={() => setMealType(item)}
            disabled={isUploading}
          >
            <Text style={[styles.chipText, mealType === item ? styles.chipTextActive : null]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={() => void startUpload()} disabled={isUploading}>
        <Text style={styles.primaryLabel}>{isUploading ? "Uploading..." : "Upload Meal"}</Text>
      </Pressable>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      {error && lastRequest ? (
        <Pressable style={styles.retryButton} onPress={() => void runUpload(lastRequest)} disabled={isUploading}>
          <Text style={styles.retryLabel}>{isUploading ? "Retrying..." : "Retry last upload"}</Text>
        </Pressable>
      ) : null}

      {lastResult ? (
        <View style={styles.resultActions}>
          <Pressable style={styles.actionButton} onPress={() => router.push(`/(protected)/record/${lastResult.mealId}`)}>
            <Text style={styles.actionLabel}>Open uploaded record</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => void openHistory()}>
            <Text style={styles.actionLabel}>Open history for date</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#eef4f8",
    gap: 10
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#243a56"
  },
  subtitle: {
    color: "#4f5f76"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  secondaryButton: {
    backgroundColor: "#d8e2ec",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  secondaryLabel: {
    color: "#243a56",
    fontWeight: "600"
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#c8d3df"
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d8e1",
    backgroundColor: "#ffffff"
  },
  mealTypeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#90a4b9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff"
  },
  chipActive: {
    borderColor: "#2f6fa8",
    backgroundColor: "#2f6fa8"
  },
  chipText: {
    color: "#39536e",
    fontSize: 12,
    fontWeight: "600"
  },
  chipTextActive: {
    color: "#ffffff"
  },
  primaryButton: {
    backgroundColor: "#2f6fa8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  primaryLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#d7e3ef",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2f6fa8"
  },
  progressText: {
    color: "#39536e",
    fontWeight: "600"
  },
  error: {
    color: "#b00020"
  },
  success: {
    color: "#276749"
  },
  retryButton: {
    backgroundColor: "#f9d7dd",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  retryLabel: {
    color: "#8b0015",
    fontWeight: "700"
  },
  resultActions: {
    gap: 10
  },
  actionButton: {
    backgroundColor: "#e2f2ff",
    borderWidth: 1,
    borderColor: "#2f6fa8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  actionLabel: {
    color: "#153c61",
    fontWeight: "700"
  }
});
