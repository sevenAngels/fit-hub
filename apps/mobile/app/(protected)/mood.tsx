import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useDailyMood, useSaveDailyMoodMutation, type MoodType } from "@/features/mood/queries";
import { getMoodTodayDate } from "@/features/mood/service";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoCard, NeoInput } from "@/shared/ui/neo-primitives";

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

      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.replace("/(protected)")} label="Back to dashboard" />

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Entry Date</Text>
        <NeoInput
          style={styles.input}
          value={recordDate}
          onChangeText={setRecordDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          editable={!isBusy}
        />
      </NeoCard>

      <NeoCard style={styles.card}>
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

        <NeoInput
          style={styles.input}
          value={stressLevelText}
          onChangeText={setStressLevelText}
          placeholder="Stress level (1-5)"
          keyboardType="decimal-pad"
          editable={!isBusy}
        />

        <NeoInput
          style={styles.input}
          value={sleepHoursText}
          onChangeText={setSleepHoursText}
          placeholder="Sleep hours (0-24, optional)"
          keyboardType="decimal-pad"
          editable={!isBusy}
        />

        <NeoInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)"
          multiline
          editable={!isBusy}
        />

        <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel} onPress={() => void submitMood()} disabled={isBusy} label={saveMoodMutation.isPending ? "Saving..." : "Save mood"} />
      </NeoCard>

      {moodQuery.isLoading ? <ActivityIndicator size="small" color={neoColors.primary} /> : null}
      {moodQuery.error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{moodQuery.error.message}</Text>
          <NeoButton variant="danger" style={styles.retryButton} labelStyle={styles.retryLabel} onPress={() => void moodQuery.refetch()} label="Retry load" />
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
    borderColor: neoColors.subtleBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: neoColors.white
  },
  choiceChipActive: {
    borderColor: neoColors.primary,
    backgroundColor: neoColors.primary
  },
  choiceText: {
    color: neoColors.muted,
    fontWeight: "600"
  },
  choiceTextActive: {
    color: neoColors.white
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
  errorCard: {
    borderWidth: 1,
    borderColor: neoColors.dangerBorder,
    borderRadius: 10,
    backgroundColor: neoColors.dangerPale,
    padding: 10,
    gap: 8
  },
  errorText: {
    color: neoColors.dangerText
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: neoColors.dangerSoft,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  retryLabel: {
    color: neoColors.dangerStrong,
    fontWeight: "700"
  },
  formError: {
    color: neoColors.dangerText
  },
  formSuccess: {
    color: neoColors.successText
  }
});
