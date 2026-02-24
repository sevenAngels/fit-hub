import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  useDashboardGoals,
  useDashboardHealth,
  useDashboardMood,
  useDashboardNutrition,
  useDashboardStreak
} from "@/features/dashboard/queries";
import { getDashboardTodayDate } from "@/features/dashboard/service";

type SummaryCardProps = {
  title: string;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  children: ReactNode;
};

function SummaryCard({ title, isLoading, error, onRetry, children }: SummaryCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>

      {isLoading ? (
        <View style={styles.cardStateRow}>
          <ActivityIndicator size="small" color="#2f6fa8" />
          <Text style={styles.cardStateText}>Loading...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.cardStateWrap}>
          <Text style={styles.cardError}>Panel unavailable. {error.message}</Text>
          <Pressable style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonLabel}>Retry panel</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error ? children : null}
    </View>
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
            <Pressable style={styles.inlineCtaButton} onPress={() => router.push("/(protected)/health")}>
              <Text style={styles.inlineCtaLabel}>Reconnect health</Text>
            </Pressable>
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
              <Pressable style={styles.inlineCtaButton} onPress={() => router.push("/(protected)/health")}>
                <Text style={styles.inlineCtaLabel}>Open health controls</Text>
              </Pressable>
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
            <Pressable style={styles.inlineCtaButton} onPress={() => router.push("/(protected)/health")}>
              <Text style={styles.inlineCtaLabel}>Reconnect health</Text>
            </Pressable>
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
              <Pressable style={styles.inlineCtaButton} onPress={() => router.push("/(protected)/health")}>
                <Text style={styles.inlineCtaLabel}>Open health controls</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </SummaryCard>

      <Pressable style={styles.uploadButton} onPress={() => router.push("/(protected)/record-upload")}>
        <Text style={styles.uploadButtonLabel}>Open record upload</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.push("/(protected)/goals")}>
        <Text style={styles.secondaryLabel}>Open goals & habits</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.push("/(protected)/mood")}>
        <Text style={styles.secondaryLabel}>Open daily mood</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.push("/(protected)/profile")}>
        <Text style={styles.secondaryLabel}>Open profile</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.push("/(protected)/subscription")}>
        <Text style={styles.secondaryLabel}>Open subscription</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.push("/(protected)/health")}>
        <Text style={styles.secondaryLabel}>Open health connect</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.push("/(protected)/report")}>
        <Text style={styles.secondaryLabel}>Open weekly report</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.push("/(protected)/record-history")}>
        <Text style={styles.secondaryLabel}>Open record history</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => void signOut()}>
        <Text style={styles.buttonLabel}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef4f8"
  },
  content: {
    padding: 20,
    gap: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#243a56"
  },
  subtitle: {
    fontSize: 16,
    color: "#4b6381"
  },
  note: {
    color: "#4f5f76",
    marginBottom: 4
  },
  legacyLabel: {
    fontSize: 12,
    color: "#7a8ca0"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ccdae8",
    padding: 12,
    gap: 6
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#243a56"
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
    color: "#4f5f76"
  },
  cardError: {
    color: "#b00020"
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#f4d3d8",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  retryButtonLabel: {
    color: "#8b0015",
    fontWeight: "700"
  },
  metricPrimary: {
    fontSize: 18,
    fontWeight: "700",
    color: "#23486a"
  },
  metricDetail: {
    color: "#4f5f76"
  },
  error: {
    color: "#b00020",
    marginBottom: 4
  },
  button: {
    backgroundColor: "#2f6fa8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18
  },
  buttonLabel: {
    color: "#ffffff",
    fontWeight: "600"
  },
  uploadButton: {
    marginTop: 16,
    backgroundColor: "#375f86",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18
  },
  uploadButtonLabel: {
    color: "#ffffff",
    fontWeight: "600"
  },
  secondaryButton: {
    backgroundColor: "#7ca9d1",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18
  },
  secondaryLabel: {
    color: "#ffffff",
    fontWeight: "600"
  },
  staleBadge: {
    borderWidth: 1,
    borderColor: "#f3c783",
    borderRadius: 10,
    backgroundColor: "#fff6e8",
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  staleBadgeLabel: {
    color: "#9b4f00",
    fontWeight: "700"
  },
  inlineCtaButton: {
    alignSelf: "flex-start",
    backgroundColor: "#d9e7f3",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 2
  },
  inlineCtaLabel: {
    color: "#23486a",
    fontWeight: "700"
  },
  warningText: {
    color: "#9b4f00"
  }
});
