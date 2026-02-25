import { useState } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

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
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoInput } from "@/shared/ui/neo-primitives";

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
        <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => void pickImage("camera")} disabled={isUploading} label="Camera" />
        <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => void pickImage("library")} disabled={isUploading} label="Gallery" />
      </View>

      {selectedImage ? <Image source={{ uri: selectedImage.uri }} style={styles.preview} /> : null}

      <NeoInput
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

      <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel} onPress={() => void startUpload()} disabled={isUploading} label={isUploading ? "Uploading..." : "Upload Meal"} />

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      {error && lastRequest ? (
        <NeoButton variant="danger" style={styles.retryButton} labelStyle={styles.retryLabel} onPress={() => void runUpload(lastRequest)} disabled={isUploading} label={isUploading ? "Retrying..." : "Retry last upload"} />
      ) : null}

      {lastResult ? (
        <View style={styles.resultActions}>
          <NeoButton variant="secondary" style={styles.actionButton} labelStyle={styles.actionLabel} onPress={() => router.push(`/(protected)/record/${lastResult.mealId}`)} label="Open uploaded record" />
          <NeoButton variant="secondary" style={styles.actionButton} labelStyle={styles.actionLabel} onPress={() => void openHistory()} label="Open history for date" />
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
    backgroundColor: neoColors.background,
    gap: 10
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: neoColors.ink
  },
  subtitle: {
    color: neoColors.muted
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  secondaryButton: {
    backgroundColor: neoColors.secondary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  secondaryLabel: {
    color: neoColors.ink,
    fontWeight: "600"
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: neoColors.secondary
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: neoColors.ink,
    backgroundColor: neoColors.white
  },
  mealTypeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: neoColors.ink,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: neoColors.white
  },
  chipActive: {
    borderColor: neoColors.primary,
    backgroundColor: neoColors.primary
  },
  chipText: {
    color: neoColors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  chipTextActive: {
    color: neoColors.white
  },
  primaryButton: {
    backgroundColor: neoColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  primaryLabel: {
    color: neoColors.white,
    fontWeight: "700"
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: neoColors.secondary,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    backgroundColor: neoColors.primary
  },
  progressText: {
    color: neoColors.muted,
    fontWeight: "600"
  },
  error: {
    color: neoColors.dangerText
  },
  success: {
    color: neoColors.successText
  },
  retryButton: {
    backgroundColor: neoColors.dangerSoft,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  retryLabel: {
    color: neoColors.dangerStrong,
    fontWeight: "700"
  },
  resultActions: {
    gap: 10
  },
  actionButton: {
    backgroundColor: neoColors.secondary,
    borderWidth: 2,
    borderColor: neoColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  actionLabel: {
    color: neoColors.ink,
    fontWeight: "700"
  }
});
