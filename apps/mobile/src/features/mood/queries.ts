import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKeys } from "@/features/dashboard/queries";

import {
  getMoodByDate,
  saveDailyMood,
  type DailyMoodEntry,
  type MoodType,
  type SaveDailyMoodInput
} from "@/features/mood/service";

export const moodQueryKeys = {
  all: ["mood"] as const,
  byDate: (date: string) => [...moodQueryKeys.all, date] as const
};

export function useDailyMood(date: string, enabled = true) {
  return useQuery<DailyMoodEntry | null, Error>({
    queryKey: moodQueryKeys.byDate(date),
    queryFn: () => getMoodByDate(date),
    enabled,
    staleTime: 60 * 1000
  });
}

export function useSaveDailyMoodMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveDailyMoodInput) => saveDailyMood(input),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: moodQueryKeys.byDate(saved.recordDate) });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.mood(saved.recordDate) });
    }
  });
}

export type { MoodType };
