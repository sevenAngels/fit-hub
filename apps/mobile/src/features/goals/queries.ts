import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKeys } from "@/features/dashboard/queries";

import {
  addHabitGoal,
  getGoalsTodayDate,
  getHabitGoals,
  getWeightGoalData,
  saveCalorieGoal,
  saveWeightGoal,
  toggleHabitCompletion,
  type HabitGoalItem,
  type ProgramGoal,
  type WeightGoalData
} from "@/features/goals/service";

export const goalsQueryKeys = {
  all: ["goals"] as const,
  weight: () => [...goalsQueryKeys.all, "weight"] as const,
  habits: (date: string) => [...goalsQueryKeys.all, "habits", date] as const
};

export function useWeightGoalData() {
  return useQuery<WeightGoalData, Error>({
    queryKey: goalsQueryKeys.weight(),
    queryFn: getWeightGoalData,
    staleTime: 5 * 60 * 1000
  });
}

export function useHabitGoals(date = getGoalsTodayDate()) {
  return useQuery<HabitGoalItem[], Error>({
    queryKey: goalsQueryKeys.habits(date),
    queryFn: () => getHabitGoals(date),
    staleTime: 60 * 1000
  });
}

export function useSaveWeightGoalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { currentWeight: number; targetWeight: number; programGoal: ProgramGoal }) => saveWeightGoal(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsQueryKeys.weight() });
      void queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.goals() });
    }
  });
}

export function useSaveCalorieGoalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetCalories: number) => saveCalorieGoal(targetCalories),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsQueryKeys.weight() });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.goals() });
    }
  });
}

export function useAddHabitGoalMutation(date = getGoalsTodayDate()) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => addHabitGoal(title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsQueryKeys.habits(date) });
      void queryClient.invalidateQueries({ queryKey: goalsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.goals() });
    }
  });
}

export function useToggleHabitCompletionMutation(date = getGoalsTodayDate()) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { goalId: string; isCompleted: boolean }) =>
      toggleHabitCompletion(input.goalId, input.isCompleted, date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalsQueryKeys.habits(date) });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.goals() });
    }
  });
}
