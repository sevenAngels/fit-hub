import { useQuery } from "@tanstack/react-query";

import {
  getDashboardGoalsSummary,
  getDashboardHealthSummary,
  getDashboardMoodSummary,
  getDashboardNutritionSummary,
  getDashboardStreakSummary,
  getDashboardTodayDate,
  type DashboardGoalsSummary,
  type DashboardHealthSummary,
  type DashboardMoodSummary,
  type DashboardNutritionSummary,
  type DashboardStreakSummary
} from "@/features/dashboard/service";

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  nutrition: (date: string) => [...dashboardQueryKeys.all, "nutrition", date] as const,
  goals: () => [...dashboardQueryKeys.all, "goals"] as const,
  streak: () => [...dashboardQueryKeys.all, "streak"] as const,
  mood: (date: string) => [...dashboardQueryKeys.all, "mood", date] as const,
  health: (date: string) => [...dashboardQueryKeys.all, "health", date] as const
};

export function useDashboardNutrition(date = getDashboardTodayDate()) {
  return useQuery<DashboardNutritionSummary, Error>({
    queryKey: dashboardQueryKeys.nutrition(date),
    queryFn: () => getDashboardNutritionSummary(date),
    staleTime: 5 * 60 * 1000
  });
}

export function useDashboardGoals() {
  return useQuery<DashboardGoalsSummary, Error>({
    queryKey: dashboardQueryKeys.goals(),
    queryFn: getDashboardGoalsSummary,
    staleTime: 5 * 60 * 1000
  });
}

export function useDashboardStreak() {
  return useQuery<DashboardStreakSummary, Error>({
    queryKey: dashboardQueryKeys.streak(),
    queryFn: getDashboardStreakSummary,
    staleTime: 5 * 60 * 1000
  });
}

export function useDashboardMood(date = getDashboardTodayDate()) {
  return useQuery<DashboardMoodSummary, Error>({
    queryKey: dashboardQueryKeys.mood(date),
    queryFn: () => getDashboardMoodSummary(date),
    staleTime: 5 * 60 * 1000
  });
}

export function useDashboardHealth(date = getDashboardTodayDate()) {
  return useQuery<DashboardHealthSummary, Error>({
    queryKey: dashboardQueryKeys.health(date),
    queryFn: () => getDashboardHealthSummary(date),
    staleTime: 60 * 1000
  });
}
