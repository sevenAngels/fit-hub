import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ListRenderItem } from "react-native";

import {
  useAddHabitGoalMutation,
  useHabitGoals,
  useSaveCalorieGoalMutation,
  useSaveWeightGoalMutation,
  useToggleHabitCompletionMutation,
  useWeightGoalData
} from "@/features/goals/queries";
import { getGoalsTodayDate, type HabitGoalItem, type ProgramGoal } from "@/features/goals/service";

function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

type HabitRowProps = {
  habit: HabitGoalItem;
  isBusy: boolean;
  onToggle: (goalId: string, nextIsCompleted: boolean) => void;
};

const HabitRow = memo(function HabitRow({ habit, isBusy, onToggle }: HabitRowProps) {
  return (
    <Pressable
      style={[styles.habitRow, habit.isCompleted ? styles.habitRowDone : null]}
      onPress={() => onToggle(habit.id, !habit.isCompleted)}
      disabled={isBusy}
    >
      <Text style={[styles.habitTitle, habit.isCompleted ? styles.habitTitleDone : null]}>{habit.title}</Text>
      <Text style={styles.habitBadge}>{habit.isCompleted ? "Done" : "Open"}</Text>
    </Pressable>
  );
});

export default function GoalsPage() {
  const router = useRouter();
  const todayDate = getGoalsTodayDate();

  const goalDataQuery = useWeightGoalData();
  const habitsQuery = useHabitGoals(todayDate);

  const saveWeightGoalMutation = useSaveWeightGoalMutation();
  const saveCalorieGoalMutation = useSaveCalorieGoalMutation();
  const addHabitMutation = useAddHabitGoalMutation(todayDate);
  const toggleHabitMutation = useToggleHabitCompletionMutation(todayDate);

  const [currentWeightText, setCurrentWeightText] = useState("");
  const [targetWeightText, setTargetWeightText] = useState("");
  const [targetCaloriesText, setTargetCaloriesText] = useState("");
  const [programGoal, setProgramGoal] = useState<ProgramGoal>("diet");
  const [newHabit, setNewHabit] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (!goalDataQuery.data) {
      return;
    }

    setCurrentWeightText(goalDataQuery.data.currentWeight.toString());
    setTargetWeightText(goalDataQuery.data.targetWeight.toString());
    setTargetCaloriesText(goalDataQuery.data.targetCalories.toString());
    setProgramGoal(goalDataQuery.data.programGoal);
  }, [goalDataQuery.data]);

  const isBusy = useMemo(
    () =>
      saveWeightGoalMutation.isPending
      || saveCalorieGoalMutation.isPending
      || addHabitMutation.isPending
      || toggleHabitMutation.isPending,
    [addHabitMutation.isPending, saveCalorieGoalMutation.isPending, saveWeightGoalMutation.isPending, toggleHabitMutation.isPending]
  );

  const submitWeightGoal = async () => {
    setFormError("");
    setFormSuccess("");

    const currentWeight = parseDecimal(currentWeightText);
    const targetWeight = parseDecimal(targetWeightText);

    if (currentWeight === null || targetWeight === null) {
      setFormError("Current/target weight must be valid numbers.");
      return;
    }

    try {
      await saveWeightGoalMutation.mutateAsync({
        currentWeight,
        targetWeight,
        programGoal
      });
      setFormSuccess("Weight goal saved.");
      void goalDataQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save weight goal.");
    }
  };

  const submitCalorieGoal = async () => {
    setFormError("");
    setFormSuccess("");

    const targetCalories = parseDecimal(targetCaloriesText);
    if (targetCalories === null) {
      setFormError("Target calories must be a valid number.");
      return;
    }

    try {
      await saveCalorieGoalMutation.mutateAsync(targetCalories);
      setFormSuccess("Target calories saved.");
      void goalDataQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save target calories.");
    }
  };

  const submitHabit = async () => {
    setFormError("");
    setFormSuccess("");

    try {
      await addHabitMutation.mutateAsync(newHabit);
      setNewHabit("");
      setFormSuccess("Habit added.");
      void habitsQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to add habit.");
    }
  };

  const toggleHabit = useCallback(async (goalId: string, nextIsCompleted: boolean) => {
    setFormError("");
    setFormSuccess("");

    try {
      await toggleHabitMutation.mutateAsync({ goalId, isCompleted: nextIsCompleted });
      void habitsQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to update habit state.");
    }
  }, [habitsQuery, toggleHabitMutation]);

  const keyExtractor = useCallback((item: HabitGoalItem) => item.id, []);

  const renderHabitItem = useCallback<ListRenderItem<HabitGoalItem>>(
    ({ item }) => <HabitRow habit={item} isBusy={isBusy} onToggle={toggleHabit} />,
    [isBusy, toggleHabit]
  );

  const renderHabitSeparator = useCallback(() => <View style={styles.habitSeparator} />, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Goals & Habits</Text>
      <Text style={styles.subtitle}>Manage weight direction, calorie target, and daily habits.</Text>

      <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(protected)")}>
        <Text style={styles.secondaryLabel}>Back to dashboard</Text>
      </Pressable>

      {goalDataQuery.isLoading ? <ActivityIndicator size="small" color="#2f6fa8" /> : null}
      {goalDataQuery.error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{goalDataQuery.error.message}</Text>
          <Pressable style={styles.retryButton} onPress={() => void goalDataQuery.refetch()}>
            <Text style={styles.retryLabel}>Retry load</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Weight Goal</Text>

        <View style={styles.choiceRow}>
          <Pressable
            style={[styles.choiceChip, programGoal === "diet" ? styles.choiceChipActive : null]}
            onPress={() => setProgramGoal("diet")}
            disabled={isBusy}
          >
            <Text style={[styles.choiceText, programGoal === "diet" ? styles.choiceTextActive : null]}>Diet</Text>
          </Pressable>
          <Pressable
            style={[styles.choiceChip, programGoal === "bulk" ? styles.choiceChipActive : null]}
            onPress={() => setProgramGoal("bulk")}
            disabled={isBusy}
          >
            <Text style={[styles.choiceText, programGoal === "bulk" ? styles.choiceTextActive : null]}>Bulk</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          value={currentWeightText}
          onChangeText={setCurrentWeightText}
          keyboardType="decimal-pad"
          placeholder="Current weight (kg)"
          editable={!isBusy}
        />
        <TextInput
          style={styles.input}
          value={targetWeightText}
          onChangeText={setTargetWeightText}
          keyboardType="decimal-pad"
          placeholder="Target weight (kg)"
          editable={!isBusy}
        />

        <Pressable style={styles.primaryButton} onPress={() => void submitWeightGoal()} disabled={isBusy}>
          <Text style={styles.primaryLabel}>{saveWeightGoalMutation.isPending ? "Saving..." : "Save weight goal"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Calorie Goal</Text>
        <TextInput
          style={styles.input}
          value={targetCaloriesText}
          onChangeText={setTargetCaloriesText}
          keyboardType="decimal-pad"
          placeholder="Target calories (kcal)"
          editable={!isBusy}
        />
        <Pressable style={styles.primaryButton} onPress={() => void submitCalorieGoal()} disabled={isBusy}>
          <Text style={styles.primaryLabel}>{saveCalorieGoalMutation.isPending ? "Saving..." : "Save calories"}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Daily Habits ({todayDate})</Text>

        <View style={styles.habitInputRow}>
          <TextInput
            style={[styles.input, styles.habitInput]}
            value={newHabit}
            onChangeText={setNewHabit}
            placeholder="Add a habit"
            editable={!isBusy}
          />
          <Pressable style={styles.addButton} onPress={() => void submitHabit()} disabled={isBusy}>
            <Text style={styles.addLabel}>{addHabitMutation.isPending ? "Adding..." : "Add"}</Text>
          </Pressable>
        </View>

        {habitsQuery.isLoading ? <ActivityIndicator size="small" color="#2f6fa8" /> : null}
        {habitsQuery.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{habitsQuery.error.message}</Text>
            <Pressable style={styles.retryButton} onPress={() => void habitsQuery.refetch()}>
              <Text style={styles.retryLabel}>Retry habits</Text>
            </Pressable>
          </View>
        ) : null}

        {habitsQuery.data?.length ? (
          <FlatList
            style={styles.habitList}
            data={habitsQuery.data}
            renderItem={renderHabitItem}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={renderHabitSeparator}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            nestedScrollEnabled
            removeClippedSubviews
          />
        ) : null}

        {!habitsQuery.isLoading && !habitsQuery.error && !habitsQuery.data?.length ? (
          <Text style={styles.emptyText}>No habits yet.</Text>
        ) : null}
      </View>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      {formSuccess ? <Text style={styles.formSuccess}>{formSuccess}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef4f8"
  },
  content: {
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#243a56"
  },
  subtitle: {
    color: "#4f5f76"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#d9e7f3",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  secondaryLabel: {
    color: "#23486a",
    fontWeight: "700"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ccdae8",
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#2c4f6f"
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8
  },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#91a5ba",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff"
  },
  choiceChipActive: {
    borderColor: "#2f6fa8",
    backgroundColor: "#2f6fa8"
  },
  choiceText: {
    color: "#39536e",
    fontWeight: "600"
  },
  choiceTextActive: {
    color: "#ffffff"
  },
  primaryButton: {
    backgroundColor: "#2f6fa8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  habitInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  habitInput: {
    flex: 1
  },
  addButton: {
    backgroundColor: "#375f86",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  addLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  habitList: {
    marginTop: 6,
    maxHeight: 280
  },
  habitRow: {
    borderWidth: 1,
    borderColor: "#bfd0df",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  habitRowDone: {
    borderColor: "#2f6fa8",
    backgroundColor: "#e8f2fb"
  },
  habitTitle: {
    color: "#243a56",
    fontWeight: "600"
  },
  habitTitleDone: {
    color: "#1f4d77"
  },
  habitBadge: {
    color: "#4f5f76"
  },
  habitSeparator: {
    height: 8
  },
  emptyText: {
    color: "#4f5f76"
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#f1b0ba",
    borderRadius: 10,
    backgroundColor: "#fff2f4",
    padding: 10,
    gap: 8
  },
  errorText: {
    color: "#b00020"
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#f4d3d8",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  retryLabel: {
    color: "#8b0015",
    fontWeight: "700"
  },
  formError: {
    color: "#b00020"
  },
  formSuccess: {
    color: "#276749"
  }
});
