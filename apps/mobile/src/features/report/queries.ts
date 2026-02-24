import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  generateWeeklyReport,
  getCurrentReportWeekStartDate,
  getWeeklyReportHealthSummary,
  getWeeklyReportByDate,
  getWeeklyReports,
  type WeeklyReportHealthSummary,
  type WeeklyReportDetail,
  type WeeklyReportSummary
} from "@/features/report/service";

export const reportQueryKeys = {
  all: ["report"] as const,
  weeklyList: () => [...reportQueryKeys.all, "weekly", "list"] as const,
  weeklyDetail: (weekStartDate: string) => [...reportQueryKeys.all, "weekly", "detail", weekStartDate] as const,
  weeklyHealth: (weekStartDate: string) => [...reportQueryKeys.all, "weekly", "health", weekStartDate] as const
};

export function useWeeklyReports(limit = 12) {
  return useQuery<WeeklyReportSummary[], Error>({
    queryKey: [...reportQueryKeys.weeklyList(), limit] as const,
    queryFn: () => getWeeklyReports(limit),
    staleTime: 60 * 1000
  });
}

export function useWeeklyReportDetail(weekStartDate = getCurrentReportWeekStartDate(), enabled = true) {
  return useQuery<WeeklyReportDetail, Error>({
    queryKey: reportQueryKeys.weeklyDetail(weekStartDate),
    queryFn: () => getWeeklyReportByDate(weekStartDate),
    enabled,
    staleTime: 60 * 1000
  });
}

export function useWeeklyReportHealthSummaryQuery(weekStartDate = getCurrentReportWeekStartDate(), enabled = true) {
  return useQuery<WeeklyReportHealthSummary, Error>({
    queryKey: reportQueryKeys.weeklyHealth(weekStartDate),
    queryFn: () => getWeeklyReportHealthSummary(weekStartDate),
    enabled,
    staleTime: 60 * 1000
  });
}

export function useGenerateWeeklyReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (weekStartDate: string) => generateWeeklyReport(weekStartDate),
    onSuccess: (detail) => {
      void queryClient.invalidateQueries({ queryKey: reportQueryKeys.weeklyList() });
      void queryClient.invalidateQueries({ queryKey: reportQueryKeys.weeklyDetail(detail.weekStartDate) });
    }
  });
}
