import { memo, useCallback, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View, type ListRenderItem } from "react-native";

import { type MealRecordListItem, useMealHistoryByDate } from "@/features/record/queries";

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
    <Pressable style={styles.card} onPress={() => onOpenRecord(meal.id)}>
      {meal.image_url ? <Image source={{ uri: meal.image_url }} style={styles.thumb} /> : null}
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{meal.food_name || "Record"}</Text>
          <Text style={styles.cardScore}>{meal.total_calories ?? 0} kcal</Text>
        </View>
        <Text style={styles.cardMeta}>{mealTypeLabels[meal.meal_type]} - {formatTime(meal.created_at)}</Text>
        {meal.ai_review ? <Text style={styles.cardReview} numberOfLines={2}>{meal.ai_review}</Text> : null}
      </View>
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
      <Pressable style={styles.uploadButton} onPress={() => router.push("/(protected)/record-upload")}>
        <Text style={styles.uploadButtonLabel}>Upload new record</Text>
      </Pressable>
    ),
    [router]
  );

  const renderItemSeparator = useCallback(() => <View style={styles.itemSeparator} />, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record History</Text>
      <Text style={styles.subtitle}>Browse and open records by date.</Text>

      <View style={styles.dateRow}>
        <TextInput style={styles.dateInput} value={draftDate} onChangeText={setDraftDate} placeholder="YYYY-MM-DD" />
        <Pressable style={styles.smallButton} onPress={() => void openDate()}>
          <Text style={styles.smallButtonLabel}>Go</Text>
        </Pressable>
        <Pressable style={styles.smallButton} onPress={applyToday}>
          <Text style={styles.smallButtonLabel}>Today</Text>
        </Pressable>
      </View>

      <Text style={styles.summary}>{summaryText}</Text>

      <Pressable style={styles.primaryButton} onPress={() => void refetch()}>
        <Text style={styles.primaryButtonLabel}>Refresh</Text>
      </Pressable>

      {isLoading ? <ActivityIndicator size="large" color="#2f6fa8" style={styles.loader} /> : null}
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
    backgroundColor: "#eef4f8"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#243a56"
  },
  subtitle: {
    color: "#4f5f76",
    marginBottom: 12
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  dateInput: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d0d8e1",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  smallButton: {
    backgroundColor: "#2f6fa8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  smallButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  summary: {
    marginTop: 12,
    color: "#4b5f76"
  },
  primaryButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#375f86",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  loader: {
    marginTop: 24
  },
  error: {
    marginTop: 16,
    color: "#b00020"
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
    color: "#4b5f76"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8d6e2",
    padding: 10,
    flexDirection: "row",
    gap: 10
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#d8e2ec"
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
    color: "#243a56",
    flex: 1
  },
  cardScore: {
    color: "#2f6fa8",
    fontWeight: "700"
  },
  cardMeta: {
    color: "#4b5f76",
    fontSize: 12
  },
  cardReview: {
    color: "#3e3e3e",
    fontSize: 12
  },
  uploadButton: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2f6fa8",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#e1edfc"
  },
  itemSeparator: {
    height: 10
  },
  uploadButtonLabel: {
    color: "#1f4f7f",
    fontWeight: "700"
  }
});
