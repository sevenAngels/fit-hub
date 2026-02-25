import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View, type ListRenderItem } from "react-native";

import {
  useAddHabitGoalMutation,
  useHabitGoals,
  useSaveCalorieGoalMutation,
  useSaveWeightGoalMutation,
  useToggleHabitCompletionMutation,
  useWeightGoalData
} from "@/features/goals/queries";
import { getGoalsTodayDate, type HabitGoalItem, type ProgramGoal } from "@/features/goals/service";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoCard, NeoInput } from "@/shared/ui/neo-primitives";

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

      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.replace("/(protected)")} label="Back to dashboard" />

      {goalDataQuery.isLoading ? <ActivityIndicator size="small" color={neoColors.primary} /> : null}
      {goalDataQuery.error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{goalDataQuery.error.message}</Text>
          <NeoButton variant="danger" style={styles.retryButton} labelStyle={styles.retryLabel} onPress={() => void goalDataQuery.refetch()} label="Retry load" />
        </View>
      ) : null}

      <NeoCard style={styles.card}>
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

        <NeoInput
          style={styles.input}
          value={currentWeightText}
          onChangeText={setCurrentWeightText}
          keyboardType="decimal-pad"
          placeholder="Current weight (kg)"
          editable={!isBusy}
        />
        <NeoInput
          style={styles.input}
          value={targetWeightText}
          onChangeText={setTargetWeightText}
          keyboardType="decimal-pad"
          placeholder="Target weight (kg)"
          editable={!isBusy}
        />

        <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel} onPress={() => void submitWeightGoal()} disabled={isBusy} label={saveWeightGoalMutation.isPending ? "Saving..." : "Save weight goal"} />
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Calorie Goal</Text>
        <NeoInput
          style={styles.input}
          value={targetCaloriesText}
          onChangeText={setTargetCaloriesText}
          keyboardType="decimal-pad"
          placeholder="Target calories (kcal)"
          editable={!isBusy}
        />
        <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel} onPress={() => void submitCalorieGoal()} disabled={isBusy} label={saveCalorieGoalMutation.isPending ? "Saving..." : "Save calories"} />
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Daily Habits ({todayDate})</Text>

        <View style={styles.habitInputRow}>
          <NeoInput
            style={[styles.input, styles.habitInput]}
            value={newHabit}
            onChangeText={setNewHabit}
            placeholder="Add a habit"
            editable={!isBusy}
          />
          <NeoButton variant="primary" style={styles.addButton} labelStyle={styles.addLabel} onPress={() => void submitHabit()} disabled={isBusy} label={addHabitMutation.isPending ? "Adding..." : "Add"} />
        </View>

        {habitsQuery.isLoading ? <ActivityIndicator size="small" color={neoColors.primary} /> : null}
        {habitsQuery.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{habitsQuery.error.message}</Text>
            <NeoButton variant="danger" style={styles.retryButton} labelStyle={styles.retryLabel} onPress={() => void habitsQuery.refetch()} label="Retry habits" />
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
      </NeoCard>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      {formSuccess ? <Text style={styles.formSuccess}>{formSuccess}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neoColors.background
  },
  content: {
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: neoColors.ink
  },
  subtitle: {
    color: neoColors.muted
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: neoColors.secondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  secondaryLabel: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  card: {
    backgroundColor: neoColors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    fontWeight: "700",
    color: neoColors.ink
  },
  input: {
    backgroundColor: neoColors.white,
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
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
    borderColor: neoColors.subtleBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: neoColors.white
  },
  choiceChipActive: {
    borderColor: neoColors.primary,
    backgroundColor: neoColors.primary
  },
  choiceText: {
    color: neoColors.muted,
    fontWeight: "600"
  },
  choiceTextActive: {
    color: neoColors.white
  },
  primaryButton: {
    backgroundColor: neoColors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryLabel: {
    color: neoColors.white,
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
    backgroundColor: neoColors.primaryStrong,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  addLabel: {
    color: neoColors.white,
    fontWeight: "700"
  },
  habitList: {
    marginTop: 6,
    maxHeight: 280
  },
  habitRow: {
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  habitRowDone: {
    borderColor: neoColors.primary,
    backgroundColor: neoColors.secondary
  },
  habitTitle: {
    color: neoColors.ink,
    fontWeight: "600"
  },
  habitTitleDone: {
    color: neoColors.muted
  },
  habitBadge: {
    color: neoColors.muted
  },
  habitSeparator: {
    height: 8
  },
  emptyText: {
    color: neoColors.muted
  },
  errorCard: {
    borderWidth: 1,
    borderColor: neoColors.dangerBorder,
    borderRadius: 10,
    backgroundColor: neoColors.dangerPale,
    padding: 10,
    gap: 8
  },
  errorText: {
    color: neoColors.dangerText
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: neoColors.dangerSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  retryLabel: {
    color: neoColors.dangerStrong,
    fontWeight: "700"
  },
  formError: {
    color: neoColors.dangerText
  },
  formSuccess: {
    color: neoColors.successText
  }
});
