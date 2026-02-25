import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View, type ListRenderItem } from "react-native";

import {
  useGenerateWeeklyReportMutation,
  useWeeklyReportHealthSummaryQuery,
  useWeeklyReportDetail,
  useWeeklyReports
} from "@/features/report/queries";
import { getCurrentReportWeekStartDate, type WeeklyReportSummary } from "@/features/report/service";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoCard, NeoInput } from "@/shared/ui/neo-primitives";

function formatDateWithTimezone(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

type WeeklyReportRowProps = {
  report: WeeklyReportSummary;
  onSelectWeek: (weekStartDate: string) => void;
};

const WeeklyReportRow = memo(function WeeklyReportRow({ report, onSelectWeek }: WeeklyReportRowProps) {
  return (
    <Pressable style={styles.listRow} onPress={() => onSelectWeek(report.weekStartDate)}>
      <Text style={styles.listPrimary}>{report.weekStartDate} - {report.weekEndDate}</Text>
      <Text style={styles.listSecondary}>{report.totalMeals} meals - {report.avgDailyCalories} kcal/day</Text>
    </Pressable>
  );
});

export default function FeedbackReportPage() {
  const router = useRouter();
  const [weekStartDate, setWeekStartDate] = useState(getCurrentReportWeekStartDate());
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(weekStartDate);

  const weeklyReportsQuery = useWeeklyReports(12);
  const weeklyDetailQuery = useWeeklyReportDetail(weekStartDate, isValidDate);
  const weeklyHealthQuery = useWeeklyReportHealthSummaryQuery(weekStartDate, isValidDate);
  const generateWeeklyReportMutation = useGenerateWeeklyReportMutation();

  const reportDetail = weeklyDetailQuery.data;
  const weeklyHealth = weeklyHealthQuery.data;
  const isBusy = useMemo(() => generateWeeklyReportMutation.isPending, [generateWeeklyReportMutation.isPending]);

  const generateForSelectedWeek = async () => {
    if (!isValidDate) {
      return;
    }

    await generateWeeklyReportMutation.mutateAsync(weekStartDate);
    void weeklyReportsQuery.refetch();
    void weeklyDetailQuery.refetch();
    void weeklyHealthQuery.refetch();
  };

  const selectWeekStartDate = useCallback((value: string) => {
    setWeekStartDate(value);
  }, []);

  const keyExtractor = useCallback((item: WeeklyReportSummary) => item.id, []);

  const renderReportRow = useCallback<ListRenderItem<WeeklyReportSummary>>(
    ({ item }) => <WeeklyReportRow report={item} onSelectWeek={selectWeekStartDate} />,
    [selectWeekStartDate]
  );

  const renderReportSeparator = useCallback(() => <View style={styles.reportSeparator} />, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Feedback & Weekly Report</Text>
      <Text style={styles.subtitle}>Report route is coupled with feedback flow.</Text>

      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.replace("/(protected)")} label="Back to dashboard" />

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Generate by Week Start</Text>
        <NeoInput
          style={styles.input}
          value={weekStartDate}
          onChangeText={setWeekStartDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          editable={!isBusy}
        />

        {!isValidDate ? <Text style={styles.errorText}>Week start must be YYYY-MM-DD.</Text> : null}

        <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel}
          onPress={() => void generateForSelectedWeek()}
          disabled={!isValidDate || isBusy} label={generateWeeklyReportMutation.isPending ? "Generating..." : "Generate weekly report"} />
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Recent Weekly Reports</Text>

        {weeklyReportsQuery.isLoading ? <ActivityIndicator size="small" color={neoColors.primary} /> : null}
        {weeklyReportsQuery.error ? <Text style={styles.errorText}>{weeklyReportsQuery.error.message}</Text> : null}

        {weeklyReportsQuery.data?.length ? (
          <FlatList
            data={weeklyReportsQuery.data}
            style={styles.listWrap}
            renderItem={renderReportRow}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={renderReportSeparator}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            nestedScrollEnabled
            removeClippedSubviews
          />
        ) : null}

        {!weeklyReportsQuery.isLoading && !weeklyReportsQuery.error && !weeklyReportsQuery.data?.length ? (
          <Text style={styles.emptyText}>No weekly reports yet.</Text>
        ) : null}
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Selected Week Detail</Text>

        {weeklyDetailQuery.isLoading ? <ActivityIndicator size="small" color={neoColors.primary} /> : null}
        {weeklyDetailQuery.error ? <Text style={styles.errorText}>{weeklyDetailQuery.error.message}</Text> : null}

        {reportDetail ? (
          <View style={styles.detailWrap}>
            <Text style={styles.detailPrimary}>{reportDetail.weekStartDate} - {reportDetail.weekEndDate}</Text>
            <Text style={styles.detailSecondary}>Meals: {reportDetail.totalMeals}</Text>
            <Text style={styles.detailSecondary}>Average calories: {reportDetail.avgDailyCalories} kcal</Text>
            <Text style={styles.detailSecondary}>C {reportDetail.avgCarbs}g · P {reportDetail.avgProtein}g · F {reportDetail.avgFat}g</Text>

            {reportDetail.totalMeals === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No data for this week</Text>
                <Text style={styles.emptyText}>No meals were recorded in the selected week. Log meals first and regenerate.</Text>
              </View>
            ) : null}

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Highlights</Text>
              {reportDetail.highlights.length ? (
                reportDetail.highlights.map((item) => (
                  <Text key={item} style={styles.blockItem}>- {item}</Text>
                ))
              ) : (
                <Text style={styles.emptyText}>No highlights.</Text>
              )}
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Improvements</Text>
              {reportDetail.improvements.length ? (
                reportDetail.improvements.map((item) => (
                  <Text key={item} style={styles.blockItem}>- {item}</Text>
                ))
              ) : (
                <Text style={styles.emptyText}>No suggestions.</Text>
              )}
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Health Summary</Text>

              {weeklyHealthQuery.isLoading ? (
                <View style={styles.inlineLoadingRow}>
                  <ActivityIndicator size="small" color={neoColors.primary} />
                  <Text style={styles.detailSecondary}>Loading health summary...</Text>
                </View>
              ) : null}

              {weeklyHealthQuery.error ? <Text style={styles.errorText}>{weeklyHealthQuery.error.message}</Text> : null}

              {!weeklyHealthQuery.isLoading && !weeklyHealthQuery.error && weeklyHealth ? (
                <>
                  {weeklyHealth.syncState === "disabled" ? (
                    <Text style={styles.emptyText}>Health feature is disabled for this build profile.</Text>
                  ) : null}

                  {weeklyHealth.syncState === "reconnect_required" ? (
                    <>
                      <Text style={styles.emptyText}>Health data unavailable for this week. Reconnect provider/permissions and retry.</Text>
                      {weeklyHealth.errorMessage ? <Text style={styles.warningText}>{weeklyHealth.errorMessage}</Text> : null}
                      <NeoButton variant="secondary" style={styles.inlineCtaButton} labelStyle={styles.inlineCtaLabel} onPress={() => router.push("/(protected)/health")} label="Reconnect health" />
                    </>
                  ) : null}

                  {weeklyHealth.syncState !== "disabled" && weeklyHealth.syncState !== "reconnect_required" ? (
                    <>
                      {weeklyHealth.hasData ? (
                        <>
                          <Text style={styles.detailSecondary}>Steps: {weeklyHealth.totalSteps}</Text>
                          <Text style={styles.detailSecondary}>Active calories: {weeklyHealth.totalActiveKcal} kcal</Text>
                          <Text style={styles.detailSecondary}>Days with data: {weeklyHealth.daysWithData}</Text>
                          <Text style={styles.detailSecondary}>Sources: {weeklyHealth.sourceCount}</Text>
                        </>
                      ) : (
                        <Text style={styles.emptyText}>No health aggregates for the selected week yet.</Text>
                      )}

                      <Text style={styles.detailSecondary}>Last sync: {formatDateWithTimezone(weeklyHealth.lastSuccessAt)}</Text>

                      {weeklyHealth.stale ? (
                        <View style={styles.staleBadge}>
                          <Text style={styles.staleBadgeLabel}>Stale health data - reconnect recommended</Text>
                        </View>
                      ) : null}

                      {weeklyHealth.isRunning ? <Text style={styles.detailSecondary}>Health sync in progress...</Text> : null}

                      {(weeklyHealth.stale || weeklyHealth.errorMessage) ? (
                        <NeoButton variant="secondary" style={styles.inlineCtaButton} labelStyle={styles.inlineCtaLabel} onPress={() => router.push("/(protected)/health")} label="Open health controls" />
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>
        ) : null}
      </NeoCard>
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
  listWrap: {
    marginTop: 4,
    maxHeight: 280
  },
  listRow: {
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4
  },
  listPrimary: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  listSecondary: {
    color: neoColors.muted
  },
  reportSeparator: {
    height: 8
  },
  detailWrap: {
    gap: 6
  },
  detailPrimary: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  detailSecondary: {
    color: neoColors.muted
  },
  block: {
    marginTop: 8,
    gap: 4
  },
  blockTitle: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  blockItem: {
    color: neoColors.muted
  },
  inlineLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  staleBadge: {
    borderWidth: 1,
    borderColor: neoColors.warningBorder,
    borderRadius: 10,
    backgroundColor: neoColors.warningSoft,
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  staleBadgeLabel: {
    color: neoColors.warningText,
    fontWeight: "700"
  },
  inlineCtaButton: {
    alignSelf: "flex-start",
    backgroundColor: neoColors.secondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 2
  },
  inlineCtaLabel: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  warningText: {
    color: neoColors.warningText
  },
  emptyCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
    borderRadius: 10,
    backgroundColor: neoColors.white,
    padding: 10,
    gap: 4
  },
  emptyTitle: {
    color: neoColors.ink,
    fontWeight: "700"
  },
  emptyText: {
    color: neoColors.muted
  },
  errorText: {
    color: neoColors.dangerText
  }
});
