import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { neoColors } from "@/shared/ui/neo-theme";

import {
  useDeleteMealRecordMutation,
  useMealDetail,
  useUpdateMealRecordMutation
} from "@/features/record/queries";
import type { MealRecordItem } from "@/features/record/service";
import { NeoButton, NeoCard, NeoInput } from "@/shared/ui/neo-primitives";

const mealTypeLabels: Record<MealRecordItem["meal_type"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  night_snack: "Night snack",
  beverage: "Beverage"
};

function formatDatetime(value: string | null) {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function asDecimal(text: string): number | null | undefined {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    return undefined;
  }

  return value;
}

export default function RecordDetailPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const mealId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";

  const { data: meal, isPending, isError, error, refetch } = useMealDetail(mealId);
  const updateMutation = useUpdateMealRecordMutation();
  const deleteMutation = useDeleteMealRecordMutation();

  const [caloriesText, setCaloriesText] = useState("");
  const [carbText, setCarbText] = useState("");
  const [proteinText, setProteinText] = useState("");
  const [fatText, setFatText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (!meal) {
      return;
    }
    setCaloriesText(meal.total_calories?.toString() ?? "");
    setCarbText(meal.total_carbohydrates_g?.toString() ?? "");
    setProteinText(meal.total_protein_g?.toString() ?? "");
    setFatText(meal.total_fat_g?.toString() ?? "");
    setNoteText(meal.user_note ?? "");
  }, [meal]);

  const onSave = async () => {
    setFormError("");
    setFormSuccess("");

    const calories = asDecimal(caloriesText);
    const carbohydrates = asDecimal(carbText);
    const protein = asDecimal(proteinText);
    const fat = asDecimal(fatText);

    if (
      (caloriesText.trim() && calories === undefined) ||
      (carbText.trim() && carbohydrates === undefined) ||
      (proteinText.trim() && protein === undefined) ||
      (fatText.trim() && fat === undefined)
    ) {
      setFormError("Please enter valid numbers for nutrition fields.");
      return;
    }

    const payload = {
      mealId,
      totalCalories: caloriesText.trim() ? calories : undefined,
      totalCarbohydratesG: carbText.trim() ? carbohydrates : undefined,
      totalProteinG: proteinText.trim() ? protein : undefined,
      totalFatG: fatText.trim() ? fat : undefined,
      userNote: noteText.trim() ? noteText.trim() : null
    };

    try {
      await updateMutation.mutateAsync(payload);
      setFormSuccess("Record updated.");
      void refetch();
    } catch (errorValue) {
      setFormError(
        errorValue instanceof Error
          ? errorValue.message
          : "Failed to save changes."
      );
    }
  };

  const onDelete = () => {
    if (!mealId) {
      return;
    }

    Alert.alert("Delete this record", "This cannot be undone.", [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(mealId);
            router.replace({ pathname: "/(protected)/record-history", params: { date: meal?.record_date } });
          } catch {
            setFormError("Failed to delete record.");
          }
        }
      }
    ]);
  };

  if (!mealId || isPending) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={neoColors.primary} />
      </View>
    );
  }

  if (isError || !meal) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.error}>{(error as Error | null)?.message ?? "Unable to load record."}</Text>
        <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => void refetch()} label="Retry load" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Record Detail</Text>

      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.replace("/(protected)/record-history")} label="Back to history" />

      <Text style={styles.recordName}>{meal.food_name ?? "Untitled record"}</Text>
      <Text style={styles.recordMeta}>
        {mealTypeLabels[meal.meal_type]} · Created {formatDatetime(meal.created_at)}
      </Text>
      <Text style={styles.recordMeta}>Date: {meal.record_date}</Text>

      {meal.image_url ? <Image source={{ uri: meal.image_url }} style={styles.image} /> : null}

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Nutrition</Text>

        <NeoInput
          style={styles.input}
          value={caloriesText}
          onChangeText={setCaloriesText}
          placeholder="Calories"
          keyboardType="decimal-pad"
        />
        <NeoInput
          style={styles.input}
          value={carbText}
          onChangeText={setCarbText}
          placeholder="Carbohydrates (g)"
          keyboardType="decimal-pad"
        />
        <NeoInput
          style={styles.input}
          value={proteinText}
          onChangeText={setProteinText}
          placeholder="Protein (g)"
          keyboardType="decimal-pad"
        />
        <NeoInput
          style={styles.input}
          value={fatText}
          onChangeText={setFatText}
          placeholder="Fat (g)"
          keyboardType="decimal-pad"
        />

        <NeoButton
          variant="primary"
          style={[styles.primaryButton, (updateMutation.isPending ? styles.disabledButton : null)]}
          labelStyle={styles.primaryLabel}
          onPress={() => void onSave()}
          disabled={updateMutation.isPending}
          label={updateMutation.isPending ? "Saving..." : "Save nutrition"}
        />
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>AI Review</Text>
        <Text style={styles.review}>{meal.ai_review ?? "No AI review."}</Text>
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <NeoInput
          style={[styles.input, styles.textArea]}
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Add your note"
          multiline
        />

        <NeoButton
          variant="primary"
          style={[styles.primaryButton, (updateMutation.isPending ? styles.disabledButton : null)]}
          labelStyle={styles.primaryLabel}
          onPress={() => void onSave()}
          disabled={updateMutation.isPending}
          label={updateMutation.isPending ? "Saving..." : "Save note"}
        />
      </NeoCard>

      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      {formSuccess ? <Text style={styles.success}>{formSuccess}</Text> : null}

      <NeoButton
        variant="danger"
        style={[styles.deleteButton, deleteMutation.isPending ? styles.disabledButton : null]}
        labelStyle={styles.deleteLabel}
        onPress={() => void onDelete()}
        disabled={deleteMutation.isPending}
        label={deleteMutation.isPending ? "Deleting..." : "Delete record"}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: neoColors.background
  },
  page: {
    backgroundColor: neoColors.background,
    padding: 16,
    gap: 10
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: neoColors.ink
  },
  secondaryButton: {
    backgroundColor: neoColors.secondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start"
  },
  secondaryLabel: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  recordName: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: "700",
    color: neoColors.ink
  },
  recordMeta: {
    color: neoColors.muted
  },
  image: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: neoColors.secondary
  },
  card: {
    backgroundColor: neoColors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: neoColors.ink,
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    fontWeight: "700",
    color: neoColors.ink
  },
  input: {
    backgroundColor: neoColors.white,
    borderWidth: 2,
    borderColor: neoColors.ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top"
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: neoColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryLabel: {
    color: neoColors.white,
    fontWeight: "700"
  },
  disabledButton: {
    opacity: 0.6
  },
  review: {
    color: neoColors.muted
  },
  error: {
    color: neoColors.dangerText
  },
  success: {
    color: neoColors.successText
  },
  deleteButton: {
    marginTop: 8,
    backgroundColor: neoColors.destructive,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  deleteLabel: {
    color: neoColors.white,
    fontWeight: "700"
  }
});
