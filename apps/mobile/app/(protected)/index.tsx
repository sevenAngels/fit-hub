import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  useDashboardGoals,
  useDashboardHealth,
  useDashboardMood,
  useDashboardNutrition,
  useDashboardStreak
} from "@/features/dashboard/queries";
import { getDashboardTodayDate } from "@/features/dashboard/service";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoCard } from "@/shared/ui/neo-primitives";

type SummaryCardProps = {
  title: string;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  children: ReactNode;
};

function SummaryCard({ title, isLoading, error, onRetry, children }: SummaryCardProps) {
  return (
    <NeoCard style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>

      {isLoading ? (
        <View style={styles.cardStateRow}>
          <ActivityIndicator size="small" color={neoColors.primary} />
          <Text style={styles.cardStateText}>Loading...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.cardStateWrap}>
          <Text style={styles.cardError}>Panel unavailable. {error.message}</Text>
          <NeoButton
            variant="danger"
            style={styles.retryButton}
            labelStyle={styles.retryButtonLabel}
            onPress={onRetry}
            label="Retry panel"
          />
        </View>
      ) : null}

      {!isLoading && !error ? children : null}
    </NeoCard>
  );
}

function formatDateWithTimezone(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

export default function ProtectedHomePage() {
  const { user, errorMessage, signOut } = useAuth();
  const router = useRouter();
  const todayDate = getDashboardTodayDate();

  const nutritionQuery = useDashboardNutrition(todayDate);
  const goalsQuery = useDashboardGoals();
  const streakQuery = useDashboardStreak();
  const moodQuery = useDashboardMood(todayDate);
  const healthQuery = useDashboardHealth(todayDate);

  const nutrition = nutritionQuery.data;
  const goals = goalsQuery.data;
  const streak = streakQuery.data;
  const mood = moodQuery.data;
  const health = healthQuery.data;

  const isHealthDisabled = health?.syncState === "disabled";
  const isHealthReconnectRequired = health?.syncState === "reconnect_required";
  const showHealthMetricCards = !!health && !isHealthDisabled && !isHealthReconnectRequired;

  const featuredGoalPercent =
    goals?.featuredProgressRatio !== null && goals?.featuredProgressRatio !== undefined
      ? Math.round(goals.featuredProgressRatio * 100)
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Welcome{user?.email ? `, ${user.email}` : ""}</Text>
      <Text style={styles.legacyLabel}>Protected Route Group</Text>
      <Text style={styles.note}>Session-based guard and SecureStore persistence are active.</Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <SummaryCard
        title="Today Nutrition"
        isLoading={nutritionQuery.isLoading}
        error={nutritionQuery.error ?? null}
        onRetry={() => void nutritionQuery.refetch()}
      >
        <Text style={styles.metricPrimary}>{nutrition?.totalCalories ?? 0} kcal</Text>
        <Text style={styles.metricDetail}>Meals: {nutrition?.mealsRecorded ?? 0}</Text>
        <Text style={styles.metricDetail}>
          C {nutrition?.totalCarbohydratesG ?? 0}g · P {nutrition?.totalProteinG ?? 0}g · F {nutrition?.totalFatG ?? 0}g
        </Text>
      </SummaryCard>

      <SummaryCard
        title="Goals Progress"
        isLoading={goalsQuery.isLoading}
        error={goalsQuery.error ?? null}
        onRetry={() => void goalsQuery.refetch()}
      >
        <Text style={styles.metricPrimary}>{goals?.activeCount ?? 0} active goal(s)</Text>
        <Text style={styles.metricDetail}>{goals?.featuredGoalTitle ?? "No featured goal"}</Text>
        <Text style={styles.metricDetail}>
          Progress: {featuredGoalPercent !== null ? `${featuredGoalPercent}%` : "No target progress available"}
        </Text>
        <Text style={styles.metricDetail}>
          Habits today: {goals?.habitsCompletedToday ?? 0}/{goals?.habitsTotal ?? 0}
        </Text>
      </SummaryCard>

      <SummaryCard
        title="Current Streak"
        isLoading={streakQuery.isLoading}
        error={streakQuery.error ?? null}
        onRetry={() => void streakQuery.refetch()}
      >
        <Text style={styles.metricPrimary}>{streak?.currentStreakDays ?? 0} day(s)</Text>
        <Text style={styles.metricDetail}>Updated from current streak store.</Text>
      </SummaryCard>

      <SummaryCard
        title="Today Mood"
        isLoading={moodQuery.isLoading}
        error={moodQuery.error ?? null}
        onRetry={() => void moodQuery.refetch()}
      >
        {mood?.hasEntry ? (
          <>
            <Text style={styles.metricPrimary}>{mood.moodStatus ?? "Logged"}</Text>
            <Text style={styles.metricDetail}>Stress: {mood.stressLevel ?? "-"}</Text>
            <Text style={styles.metricDetail}>Sleep: {mood.sleepHours ?? "-"}h</Text>
          </>
        ) : (
          <>
            <Text style={styles.metricPrimary}>No mood entry</Text>
            <Text style={styles.metricDetail}>Add mood for {todayDate} when the mood module is ready.</Text>
          </>
        )}
      </SummaryCard>

      <SummaryCard
        title="Health Steps"
        isLoading={healthQuery.isLoading}
        error={healthQuery.error ?? null}
        onRetry={() => void healthQuery.refetch()}
      >
        {isHealthDisabled ? (
          <>
            <Text style={styles.metricPrimary}>Health disabled</Text>
            <Text style={styles.metricDetail}>Health feature flags are off for this profile.</Text>
          </>
        ) : null}

        {isHealthReconnectRequired ? (
          <>
            <Text style={styles.metricPrimary}>Reconnect required</Text>
            <Text style={styles.metricDetail}>Provider or permission is not ready yet.</Text>
            {health?.errorMessage ? <Text style={styles.warningText}>{health.errorMessage}</Text> : null}
            <NeoButton variant="secondary" style={styles.inlineCtaButton} labelStyle={styles.inlineCtaLabel} onPress={() => router.push("/(protected)/health")} label="Reconnect health" />
          </>
        ) : null}

        {showHealthMetricCards ? (
          <>
            <Text style={styles.metricPrimary}>{health.steps} steps</Text>
            <Text style={styles.metricDetail}>Last sync: {formatDateWithTimezone(health.lastSuccessAt)}</Text>

            {health.stale ? (
              <View style={styles.staleBadge}>
                <Text style={styles.staleBadgeLabel}>Stale data - reconnect recommended</Text>
              </View>
            ) : null}

            {health.isRunning ? <Text style={styles.metricDetail}>Sync in progress...</Text> : null}

            {(health.stale || health.errorMessage) ? (
              <NeoButton variant="secondary" style={styles.inlineCtaButton} labelStyle={styles.inlineCtaLabel} onPress={() => router.push("/(protected)/health")} label="Open health controls" />
            ) : null}
          </>
        ) : null}
      </SummaryCard>

      <SummaryCard
        title="Health Active Calories"
        isLoading={healthQuery.isLoading}
        error={healthQuery.error ?? null}
        onRetry={() => void healthQuery.refetch()}
      >
        {isHealthDisabled ? (
          <>
            <Text style={styles.metricPrimary}>Health disabled</Text>
            <Text style={styles.metricDetail}>Health feature flags are off for this profile.</Text>
          </>
        ) : null}

        {isHealthReconnectRequired ? (
          <>
            <Text style={styles.metricPrimary}>Reconnect required</Text>
            <Text style={styles.metricDetail}>Provider or permission is not ready yet.</Text>
            {health?.errorMessage ? <Text style={styles.warningText}>{health.errorMessage}</Text> : null}
            <NeoButton variant="secondary" style={styles.inlineCtaButton} labelStyle={styles.inlineCtaLabel} onPress={() => router.push("/(protected)/health")} label="Reconnect health" />
          </>
        ) : null}

        {showHealthMetricCards ? (
          <>
            <Text style={styles.metricPrimary}>{health.activeKcal} active kcal</Text>
            <Text style={styles.metricDetail}>Sources: {health.sourceCount}</Text>
            <Text style={styles.metricDetail}>Last sync: {formatDateWithTimezone(health.lastSuccessAt)}</Text>

            {health.stale ? (
              <View style={styles.staleBadge}>
                <Text style={styles.staleBadgeLabel}>Stale data - reconnect recommended</Text>
              </View>
            ) : null}

            {(health.stale || health.errorMessage) ? (
              <NeoButton variant="secondary" style={styles.inlineCtaButton} labelStyle={styles.inlineCtaLabel} onPress={() => router.push("/(protected)/health")} label="Open health controls" />
            ) : null}
          </>
        ) : null}
      </SummaryCard>

      <NeoButton variant="primary" style={styles.uploadButton} labelStyle={styles.uploadButtonLabel} onPress={() => router.push("/(protected)/record-upload")} label="Open record upload" />
      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.push("/(protected)/goals")} label="Open goals & habits" />
      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.push("/(protected)/mood")} label="Open daily mood" />
      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.push("/(protected)/profile")} label="Open profile" />
      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.push("/(protected)/subscription")} label="Open subscription" />
      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.push("/(protected)/health")} label="Open health connect" />
      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.push("/(protected)/report")} label="Open weekly report" />
      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.push("/(protected)/record-history")} label="Open record history" />
      <NeoButton variant="primary" style={styles.button} labelStyle={styles.buttonLabel} onPress={() => void signOut()} label="Sign out" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neoColors.background
  },
  content: {
    padding: 20,
    gap: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: neoColors.ink
  },
  subtitle: {
    fontSize: 16,
    color: neoColors.mutedStrong
  },
  note: {
    color: neoColors.muted,
    marginBottom: 4
  },
  legacyLabel: {
    fontSize: 12,
    color: neoColors.mutedStrong
  },
  card: {
    backgroundColor: neoColors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
    padding: 12,
    gap: 6
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: neoColors.ink
  },
  cardStateWrap: {
    gap: 8
  },
  cardStateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardStateText: {
    color: neoColors.muted
  },
  cardError: {
    color: neoColors.dangerText
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: neoColors.dangerSoft,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  retryButtonLabel: {
    color: neoColors.dangerStrong,
    fontWeight: "700"
  },
  metricPrimary: {
    fontSize: 18,
    fontWeight: "700",
    color: neoColors.ink
  },
  metricDetail: {
    color: neoColors.muted
  },
  error: {
    color: neoColors.dangerText,
    marginBottom: 4
  },
  button: {
    backgroundColor: neoColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18
  },
  buttonLabel: {
    color: neoColors.white,
    fontWeight: "600"
  },
  uploadButton: {
    marginTop: 16,
    backgroundColor: neoColors.primaryStrong,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18
  },
  uploadButtonLabel: {
    color: neoColors.white,
    fontWeight: "600"
  },
  secondaryButton: {
    backgroundColor: neoColors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18
  },
  secondaryLabel: {
    color: neoColors.white,
    fontWeight: "600"
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
  }
});
