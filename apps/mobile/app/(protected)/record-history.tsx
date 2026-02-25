import { memo, useCallback, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View, type ListRenderItem } from "react-native";

import { type MealRecordListItem, useMealHistoryByDate } from "@/features/record/queries";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoCard, NeoInput } from "@/shared/ui/neo-primitives";

const mealTypeLabels: Record<MealRecordListItem["meal_type"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  night_snack: "Night snack",
  beverage: "Beverage"
};

function toTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateQueryValue(raw: string | string[] | undefined): string {
  if (!raw) {
    return toTodayDate();
  }

  const value = Array.isArray(raw) ? raw[0] : raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return toTodayDate();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

type MealHistoryCardProps = {
  meal: MealRecordListItem;
  onOpenRecord: (mealId: string) => void;
};

const MealHistoryCard = memo(function MealHistoryCard({ meal, onOpenRecord }: MealHistoryCardProps) {
  return (
    <Pressable onPress={() => onOpenRecord(meal.id)}>
      <NeoCard style={styles.card}>
        {meal.image_url ? <Image source={{ uri: meal.image_url }} style={styles.thumb} /> : null}
        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{meal.food_name || "Record"}</Text>
            <Text style={styles.cardScore}>{meal.total_calories ?? 0} kcal</Text>
          </View>
          <Text style={styles.cardMeta}>{mealTypeLabels[meal.meal_type]} - {formatTime(meal.created_at)}</Text>
          {meal.ai_review ? <Text style={styles.cardReview} numberOfLines={2}>{meal.ai_review}</Text> : null}
        </View>
      </NeoCard>
    </Pressable>
  );
});

export default function RecordHistoryPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const [selectedDate, setSelectedDate] = useState(() => parseDateQueryValue(params.date));
  const [draftDate, setDraftDate] = useState(selectedDate);

  const dateToUse = parseDateQueryValue(selectedDate);

  const { data: meals = [], isLoading, isError, error, refetch } = useMealHistoryByDate(dateToUse);

  const summaryText = useMemo(() => {
    if (meals.length === 0) {
      return "No records for selected date.";
    }

    const totalCalories = meals.reduce((sum, meal) => sum + (meal.total_calories ?? 0), 0);
    return `${meals.length} record(s) · ${totalCalories} total calories`;
  }, [meals]);

  const openDate = () => {
    setSelectedDate(draftDate.trim());
  };

  const applyToday = () => {
    const today = toTodayDate();
    setDraftDate(today);
    setSelectedDate(today);
  };

  const openRecord = useCallback(
    (mealId: string) => {
      router.push(`/(protected)/record/${mealId}`);
    },
    [router]
  );

  const keyExtractor = useCallback((item: MealRecordListItem) => item.id, []);

  const renderMealItem = useCallback<ListRenderItem<MealRecordListItem>>(
    ({ item }) => <MealHistoryCard meal={item} onOpenRecord={openRecord} />,
    [openRecord]
  );

  const renderListEmpty = useCallback(() => <Text style={styles.empty}>No records yet.</Text>, []);

  const renderListFooter = useCallback(
    () => (
      <NeoButton
        variant="primary"
        style={styles.uploadButton}
        labelStyle={styles.uploadButtonLabel}
        onPress={() => router.push("/(protected)/record-upload")}
        label="Upload new record"
      />
    ),
    [router]
  );

  const renderItemSeparator = useCallback(() => <View style={styles.itemSeparator} />, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record History</Text>
      <Text style={styles.subtitle}>Browse and open records by date.</Text>

      <View style={styles.dateRow}>
        <NeoInput style={styles.dateInput} value={draftDate} onChangeText={setDraftDate} placeholder="YYYY-MM-DD" />
        <NeoButton variant="primary" style={styles.smallButton} labelStyle={styles.smallButtonLabel} onPress={() => void openDate()} label="Go" />
        <NeoButton variant="primary" style={styles.smallButton} labelStyle={styles.smallButtonLabel} onPress={applyToday} label="Today" />
      </View>

      <Text style={styles.summary}>{summaryText}</Text>

      <NeoButton
        variant="primary"
        style={styles.primaryButton}
        labelStyle={styles.primaryButtonLabel}
        onPress={() => void refetch()}
        label="Refresh"
      />

      {isLoading ? <ActivityIndicator size="large" color={neoColors.primary} style={styles.loader} /> : null}
      {isError ? <Text style={styles.error}>{(error as Error | null)?.message ?? "Failed to load records."}</Text> : null}

      {!isLoading && !isError ? (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={meals}
          renderItem={renderMealItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderListEmpty}
          ListFooterComponent={renderListFooter}
          ItemSeparatorComponent={renderItemSeparator}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: neoColors.background
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: neoColors.ink
  },
  subtitle: {
    color: neoColors.muted,
    marginBottom: 12
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  dateInput: {
    flex: 1,
    backgroundColor: neoColors.white,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: neoColors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  smallButton: {
    backgroundColor: neoColors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  smallButtonLabel: {
    color: neoColors.white,
    fontWeight: "700"
  },
  summary: {
    marginTop: 12,
    color: neoColors.muted
  },
  primaryButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: neoColors.primaryStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  primaryButtonLabel: {
    color: neoColors.white,
    fontWeight: "700"
  },
  loader: {
    marginTop: 24
  },
  error: {
    marginTop: 16,
    color: neoColors.dangerText
  },
  list: {
    marginTop: 8,
    flex: 1
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1
  },
  empty: {
    marginTop: 20,
    color: neoColors.muted
  },
  card: {
    backgroundColor: neoColors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: neoColors.ink,
    padding: 10,
    flexDirection: "row",
    gap: 10
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: neoColors.secondary
  },
  cardBody: {
    flex: 1,
    gap: 4
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  cardTitle: {
    fontWeight: "700",
    color: neoColors.ink,
    flex: 1
  },
  cardScore: {
    color: neoColors.primary,
    fontWeight: "700"
  },
  cardMeta: {
    color: neoColors.muted,
    fontSize: 12
  },
  cardReview: {
    color: neoColors.muted,
    fontSize: 12
  },
  uploadButton: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: neoColors.primary,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: neoColors.secondary
  },
  itemSeparator: {
    height: 10
  },
  uploadButtonLabel: {
    color: neoColors.muted,
    fontWeight: "700"
  }
});
