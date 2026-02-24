import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKeys } from "@/features/dashboard/queries";

import {
  deleteMealRecord,
  getMealById,
  getMealsByDate,
  type MealRecordItem,
  type MealRecordListItem,
  type UpdateMealRecordPayload,
  updateMealRecord
} from "@/features/record/service";

export type { MealRecordListItem, MealRecordItem, UpdateMealRecordPayload };

export const mealQueryKeys = {
  all: ["meal-records"] as const,
  byDate: (date: string) => [...mealQueryKeys.all, "history", date] as const,
  detail: (mealId: string) => [...mealQueryKeys.all, "detail", mealId] as const
};

export function useMealHistoryByDate(date: string) {
  return useQuery<MealRecordListItem[], Error>({
    queryKey: mealQueryKeys.byDate(date),
    queryFn: () => getMealsByDate(date),
    enabled: Boolean(date)
  });
}

export function useMealDetail(mealId: string | null) {
  return useQuery<MealRecordItem, Error>({
    queryKey: mealQueryKeys.detail(mealId ?? ""),
    queryFn: () => {
      if (!mealId) {
        throw new Error("Meal id is required.");
      }
      return getMealById(mealId);
    },
    enabled: Boolean(mealId)
  });
}

export function useUpdateMealRecordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mealId, ...payload }: { mealId: string } & UpdateMealRecordPayload) =>
      updateMealRecord(mealId, payload),
    onSuccess: (updated, { mealId }) => {
      void queryClient.invalidateQueries({ queryKey: mealQueryKeys.detail(mealId) });
      void queryClient.invalidateQueries({ queryKey: mealQueryKeys.byDate(updated.record_date) });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.nutrition(updated.record_date) });
    }
  });
}

export function useDeleteMealRecordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mealId: string) => deleteMealRecord(mealId),
    onSuccess: (result, mealId) => {
      void queryClient.invalidateQueries({ queryKey: mealQueryKeys.byDate(result.recordDate) });
      void queryClient.invalidateQueries({ queryKey: mealQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.nutrition(result.recordDate) });
      void queryClient.removeQueries({ queryKey: mealQueryKeys.detail(mealId) });
    }
  });
}
