import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useDailyMood, useSaveDailyMoodMutation, type MoodType } from "@/features/mood/queries";
import { getMoodTodayDate } from "@/features/mood/service";

function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

const moodOptions: MoodType[] = ["happy", "neutral", "sad", "angry", "stressed"];

export default function MoodPage() {
  const router = useRouter();
  const [recordDate, setRecordDate] = useState(getMoodTodayDate());
  const [selectedMood, setSelectedMood] = useState<MoodType>("neutral");
  const [stressLevelText, setStressLevelText] = useState("3");
  const [sleepHoursText, setSleepHoursText] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const moodQuery = useDailyMood(recordDate, /^\d{4}-\d{2}-\d{2}$/.test(recordDate));
  const saveMoodMutation = useSaveDailyMoodMutation();

  useEffect(() => {
    if (!moodQuery.data) {
      setSelectedMood("neutral");
      setStressLevelText("3");
      setSleepHoursText("");
      setNotes("");
      return;
    }

    setSelectedMood(moodQuery.data.moodType);
    setStressLevelText(moodQuery.data.stressLevel.toString());
    setSleepHoursText(moodQuery.data.sleepHours === null ? "" : moodQuery.data.sleepHours.toString());
    setNotes(moodQuery.data.notes);
  }, [moodQuery.data]);

  const isBusy = useMemo(() => saveMoodMutation.isPending, [saveMoodMutation.isPending]);

  const submitMood = async () => {
    setFormError("");
    setFormSuccess("");

    const stressLevel = parseDecimal(stressLevelText);
    if (stressLevel === null) {
      setFormError("Stress level must be a valid number.");
      return;
    }

    const sleepHoursRaw = sleepHoursText.trim();
    const sleepHours = sleepHoursRaw ? parseDecimal(sleepHoursRaw) : null;
    if (sleepHoursRaw && sleepHours === null) {
      setFormError("Sleep hours must be a valid number.");
      return;
    }

    try {
      await saveMoodMutation.mutateAsync({
        recordDate,
        moodType: selectedMood,
        stressLevel,
        sleepHours,
        notes
      });

      setFormSuccess("Mood saved.");
      void moodQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save mood.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Daily Mood</Text>
      <Text style={styles.subtitle}>Save and re-save same-day mood with upsert behavior.</Text>

      <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(protected)")}>
        <Text style={styles.secondaryLabel}>Back to dashboard</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Entry Date</Text>
        <TextInput
          style={styles.input}
          value={recordDate}
          onChangeText={setRecordDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          editable={!isBusy}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Mood Type</Text>
        <View style={styles.choiceWrap}>
          {moodOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.choiceChip, selectedMood === option ? styles.choiceChipActive : null]}
              onPress={() => setSelectedMood(option)}
              disabled={isBusy}
            >
              <Text style={[styles.choiceText, selectedMood === option ? styles.choiceTextActive : null]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          value={stressLevelText}
          onChangeText={setStressLevelText}
          placeholder="Stress level (1-5)"
          keyboardType="decimal-pad"
          editable={!isBusy}
        />

        <TextInput
          style={styles.input}
          value={sleepHoursText}
          onChangeText={setSleepHoursText}
          placeholder="Sleep hours (0-24, optional)"
          keyboardType="decimal-pad"
          editable={!isBusy}
        />

        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)"
          multiline
          editable={!isBusy}
        />

        <Pressable style={styles.primaryButton} onPress={() => void submitMood()} disabled={isBusy}>
          <Text style={styles.primaryLabel}>{saveMoodMutation.isPending ? "Saving..." : "Save mood"}</Text>
        </Pressable>
      </View>

      {moodQuery.isLoading ? <ActivityIndicator size="small" color="#2f6fa8" /> : null}
      {moodQuery.error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{moodQuery.error.message}</Text>
          <Pressable style={styles.retryButton} onPress={() => void moodQuery.refetch()}>
            <Text style={styles.retryLabel}>Retry load</Text>
          </Pressable>
        </View>
      ) : null}

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      {formSuccess ? <Text style={styles.formSuccess}>{formSuccess}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef4f8"
  },
  content: {
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#243a56"
  },
  subtitle: {
    color: "#4f5f76"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#d9e7f3",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  secondaryLabel: {
    color: "#23486a",
    fontWeight: "700"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ccdae8",
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#2c4f6f"
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: "top"
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#91a5ba",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff"
  },
  choiceChipActive: {
    borderColor: "#2f6fa8",
    backgroundColor: "#2f6fa8"
  },
  choiceText: {
    color: "#39536e",
    fontWeight: "600"
  },
  choiceTextActive: {
    color: "#ffffff"
  },
  primaryButton: {
    backgroundColor: "#2f6fa8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryLabel: {
    color: "#ffffff",
    fontWeight: "700"
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#f1b0ba",
    borderRadius: 10,
    backgroundColor: "#fff2f4",
    padding: 10,
    gap: 8
  },
  errorText: {
    color: "#b00020"
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#f4d3d8",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  retryLabel: {
    color: "#8b0015",
    fontWeight: "700"
  },
  formError: {
    color: "#b00020"
  },
  formSuccess: {
    color: "#276749"
  }
});
