import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "@/features/auth/auth-provider";
import { supabase } from "@/infrastructure/supabase/client";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoInput } from "@/shared/ui/neo-primitives";

const ONBOARDING_DRAFT_KEY = "fit-hub-onboarding-draft";

const basicSchema = z.object({
  nickname: z.string().min(2, "Nickname must be at least 2 characters.")
});

const bodySchema = z.object({
  heightCm: z.coerce.number().positive("Height must be greater than 0."),
  currentWeightKg: z.coerce.number().positive("Weight must be greater than 0.")
});

const mbtiSchema = z.object({
  mbti: z.string().min(4, "MBTI must have 4 letters.").max(4, "MBTI must have 4 letters.")
});

type OnboardingDraft = {
  nickname: string;
  heightCm: string;
  currentWeightKg: string;
  mbti: string;
};

const initialDraft: OnboardingDraft = {
  nickname: "",
  heightCm: "",
  currentWeightKg: "",
  mbti: ""
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshAuthState, signOut } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(ONBOARDING_DRAFT_KEY).then((raw) => {
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
        setDraft({
          nickname: parsed.nickname ?? "",
          heightCm: parsed.heightCm ?? "",
          currentWeightKg: parsed.currentWeightKg ?? "",
          mbti: parsed.mbti ?? ""
        });
      } catch {
        void AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
      }
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const stepTitle = useMemo(() => {
    if (step === 1) return "Step 1 of 3 - Basic";
    if (step === 2) return "Step 2 of 3 - Body";
    return "Step 3 of 3 - MBTI";
  }, [step]);

  const goNext = () => {
    setError("");

    if (step === 1) {
      const result = basicSchema.safeParse({ nickname: draft.nickname.trim() });
      if (!result.success) {
        setError(result.error.issues[0]?.message ?? "Invalid nickname.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      const result = bodySchema.safeParse({
        heightCm: draft.heightCm,
        currentWeightKg: draft.currentWeightKg
      });

      if (!result.success) {
        setError(result.error.issues[0]?.message ?? "Invalid body info.");
        return;
      }
      setStep(3);
    }
  };

  const submit = async () => {
    if (!user) {
      setError("No authenticated user found.");
      return;
    }

    const body = bodySchema.safeParse({
      heightCm: draft.heightCm,
      currentWeightKg: draft.currentWeightKg
    });
    const mbti = mbtiSchema.safeParse({ mbti: draft.mbti.trim().toUpperCase() });

    if (!body.success) {
      setError(body.error.issues[0]?.message ?? "Invalid body info.");
      return;
    }
    if (!mbti.success) {
      setError(mbti.error.issues[0]?.message ?? "Invalid MBTI.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        onboarding_completed: true,
        height_cm: body.data.heightCm,
        current_weight_kg: body.data.currentWeightKg
      })
      .eq("user_id", user.id);

    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
    await refreshAuthState();
    router.replace("/(protected)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Onboarding</Text>
      <Text style={styles.subtitle}>{stepTitle}</Text>

      {step === 1 ? (
        <NeoInput
          style={styles.input}
          value={draft.nickname}
          onChangeText={(nickname) => setDraft((prev) => ({ ...prev, nickname }))}
          placeholder="Nickname"
        />
      ) : null}

      {step === 2 ? (
        <>
          <NeoInput
            style={styles.input}
            value={draft.heightCm}
            onChangeText={(heightCm) => setDraft((prev) => ({ ...prev, heightCm }))}
            placeholder="Height (cm)"
            keyboardType="numeric"
          />
          <NeoInput
            style={styles.input}
            value={draft.currentWeightKg}
            onChangeText={(currentWeightKg) => setDraft((prev) => ({ ...prev, currentWeightKg }))}
            placeholder="Current weight (kg)"
            keyboardType="numeric"
          />
        </>
      ) : null}

      {step === 3 ? (
        <NeoInput
          style={styles.input}
          value={draft.mbti}
          onChangeText={(mbti) => setDraft((prev) => ({ ...prev, mbti: mbti.toUpperCase() }))}
          placeholder="MBTI (e.g. INFP)"
          autoCapitalize="characters"
          maxLength={4}
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {step > 1 ? (
          <NeoButton
            variant="secondary"
            style={styles.secondaryButton}
            labelStyle={styles.secondaryLabel}
            onPress={() => setStep((prev) => (prev === 2 ? 1 : 2))}
            label="Back"
          />
        ) : (
          <NeoButton
            variant="secondary"
            style={styles.secondaryButton}
            labelStyle={styles.secondaryLabel}
            onPress={() => void signOut()}
            label="Sign out"
          />
        )}

        {step < 3 ? (
          <NeoButton
            variant="primary"
            style={styles.primaryButton}
            labelStyle={styles.primaryLabel}
            onPress={goNext}
            label="Next"
          />
        ) : (
          <NeoButton
            variant="primary"
            style={styles.primaryButton}
            labelStyle={styles.primaryLabel}
            onPress={submit}
            disabled={isSubmitting}
            label={isSubmitting ? "Saving..." : "Complete"}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
    backgroundColor: neoColors.background
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: neoColors.ink
  },
  subtitle: {
    fontSize: 16,
    color: neoColors.muted
  },
  input: {
    width: "100%",
    maxWidth: 360,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: neoColors.ink,
    backgroundColor: neoColors.white
  },
  error: {
    color: neoColors.dangerText,
    textAlign: "center"
  },
  actions: {
    width: "100%",
    maxWidth: 360,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  primaryButton: {
    backgroundColor: neoColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 140,
    alignItems: "center"
  },
  primaryLabel: {
    color: neoColors.white,
    fontWeight: "600"
  },
  secondaryButton: {
    backgroundColor: neoColors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 120,
    alignItems: "center"
  },
  secondaryLabel: {
    color: neoColors.ink,
    fontWeight: "600"
  }
});
