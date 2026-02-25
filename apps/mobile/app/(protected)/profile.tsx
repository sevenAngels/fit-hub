import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  pickAvatarImage,
  useUpdateProfileMutation,
  useUploadProfileAvatarMutation,
  useUserProfile
} from "@/features/profile/queries";
import { useCreateCheckoutSessionMutation, useSubscriptionStatus } from "@/features/subscription/queries";
import { neoColors } from "@/shared/ui/neo-theme";
import { NeoButton, NeoCard, NeoInput } from "@/shared/ui/neo-primitives";

const MBTI_VALUES = [
  "", "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP"
] as const;

function toDisplayDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString();
}

export default function ProfilePage() {
  const router = useRouter();
  const { refreshAuthState } = useAuth();
  const profileQuery = useUserProfile();
  const updateProfileMutation = useUpdateProfileMutation();
  const uploadAvatarMutation = useUploadProfileAvatarMutation();
  const subscriptionQuery = useSubscriptionStatus();
  const checkoutMutation = useCreateCheckoutSessionMutation();
  const checkoutIntent = "upgrade" as const;

  const [nickname, setNickname] = useState("");
  const [mbti, setMbti] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [billingMessage, setBillingMessage] = useState("");

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setNickname(profileQuery.data.nickname);
    setMbti(profileQuery.data.mbti);
  }, [profileQuery.data]);

  const isBusy = useMemo(
    () =>
      updateProfileMutation.isPending ||
      uploadAvatarMutation.isPending ||
      checkoutMutation.isPending,
    [updateProfileMutation.isPending, uploadAvatarMutation.isPending, checkoutMutation.isPending]
  );

  const submitProfile = async () => {
    setFormError("");
    setFormSuccess("");

    try {
      await updateProfileMutation.mutateAsync({ nickname, mbti });
      await refreshAuthState();
      setFormSuccess("Profile saved.");
      void profileQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save profile.");
    }
  };

  const uploadAvatar = async () => {
    setFormError("");
    setFormSuccess("");

    try {
      const picked = await pickAvatarImage();
      if (!picked) {
        return;
      }

      await uploadAvatarMutation.mutateAsync(picked);
      await refreshAuthState();
      setFormSuccess("Avatar updated.");
      void profileQuery.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to upload avatar.");
    }
  };

  const startCheckout = async () => {
    setBillingMessage("");
    try {
      const { checkoutUrl } = await checkoutMutation.mutateAsync(checkoutIntent);
      await Linking.openURL(checkoutUrl);
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : "Unable to open checkout.");
    }
  };

  const avatarUrl = profileQuery.data?.avatarUrl ?? null;
  const email = profileQuery.data?.email ?? "";
  const subscriptionStatus = subscriptionQuery.data;

  const subscriptionLabel = subscriptionStatus?.isActive ? "Active" : "Inactive";
  const planName = subscriptionStatus?.plan ?? "No active plan";
  const renewalDate = toDisplayDate(subscriptionStatus?.currentPeriodEnd ?? null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Edit profile and manage account.</Text>

      <NeoButton variant="secondary" style={styles.secondaryButton} labelStyle={styles.secondaryLabel} onPress={() => router.replace("/(protected)")} label="Back to dashboard" />

      {profileQuery.isLoading ? <ActivityIndicator size="small" color={neoColors.primary} /> : null}
      {profileQuery.error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{profileQuery.error.message}</Text>
          <NeoButton variant="danger" style={styles.retryButton} labelStyle={styles.retryLabel} onPress={() => void profileQuery.refetch()} label="Retry load" />
        </View>
      ) : null}

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.subscriptionRow}>
          <Text style={styles.subscriptionLabel}>Status</Text>
          <Text style={[styles.subscriptionBadge, subscriptionStatus?.isActive ? styles.subscriptionActive : styles.subscriptionInactive]}>
            {subscriptionLabel}
          </Text>
        </View>

        <Text style={styles.subscriptionText}>Plan: {planName}</Text>
        <Text style={styles.subscriptionText}>Renews: {renewalDate}</Text>

        {subscriptionQuery.isLoading ? <ActivityIndicator size="small" color={neoColors.primary} /> : null}
        {subscriptionQuery.error ? <Text style={styles.subscriptionError}>{subscriptionQuery.error.message}</Text> : null}

        <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel} onPress={() => void startCheckout()} disabled={isBusy} label={checkoutMutation.isPending ? "Opening checkout..." : subscriptionStatus?.isActive ? "Manage subscription" : "Upgrade subscription"} />

        <Text style={styles.hintText}>Subscription checkout uses web flow for this MVP.</Text>
        {billingMessage ? <Text style={styles.billingMessage}>{billingMessage}</Text> : null}
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Avatar</Text>

        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{nickname ? nickname.slice(0, 1).toUpperCase() : "?"}</Text>
            </View>
          )}
        </View>

        <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel} onPress={() => void uploadAvatar()} disabled={isBusy} label={uploadAvatarMutation.isPending ? "Uploading..." : "Upload avatar"} />
        <Text style={styles.hintText}>Supported: JPG, PNG, WebP, GIF, HEIC, HEIF (max 10MB)</Text>
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.sectionTitle}>Profile Info</Text>

        <Text style={styles.fieldLabel}>Nickname</Text>
        <NeoInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          maxLength={6}
          placeholder="Nickname"
          editable={!isBusy}
        />

        <Text style={styles.fieldLabel}>Email</Text>
        <NeoInput style={[styles.input, styles.disabledInput]} value={email} editable={false} />

        <Text style={styles.fieldLabel}>MBTI</Text>
        <View style={styles.chipWrap}>
          {MBTI_VALUES.map((value) => (
            <Pressable
              key={value || "none"}
              style={[styles.chip, mbti === value ? styles.chipActive : null]}
              onPress={() => setMbti(value)}
              disabled={isBusy}
            >
              <Text style={[styles.chipText, mbti === value ? styles.chipTextActive : null]}>{value || "None"}</Text>
            </Pressable>
          ))}
        </View>

        <NeoButton variant="primary" style={styles.primaryButton} labelStyle={styles.primaryLabel} onPress={() => void submitProfile()} disabled={isBusy} label={updateProfileMutation.isPending ? "Saving..." : "Save profile"} />
      </NeoCard>

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
  subscriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  subscriptionLabel: {
    color: neoColors.muted,
    fontWeight: "600"
  },
  subscriptionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
    fontWeight: "700",
    fontSize: 12
  },
  subscriptionActive: {
    borderColor: neoColors.successBorder,
    backgroundColor: neoColors.successSoft,
    color: neoColors.successStrong
  },
  subscriptionInactive: {
    borderColor: neoColors.dangerText,
    backgroundColor: neoColors.dangerPaler,
    color: neoColors.dangerStrong
  },
  subscriptionText: {
    color: neoColors.muted
  },
  subscriptionError: {
    color: neoColors.dangerText
  },
  billingMessage: {
    color: neoColors.dangerStrong
  },
  avatarWrap: {
    alignItems: "center",
    marginVertical: 8
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: neoColors.subtleBorder
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: neoColors.secondary
  },
  avatarFallbackText: {
    fontSize: 32,
    color: neoColors.ink,
    fontWeight: "700"
  },
  fieldLabel: {
    color: neoColors.muted,
    fontWeight: "600"
  },
  input: {
    backgroundColor: neoColors.white,
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  disabledInput: {
    color: neoColors.mutedStrong,
    backgroundColor: neoColors.secondary
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: neoColors.subtleBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: neoColors.white
  },
  chipActive: {
    borderColor: neoColors.primary,
    backgroundColor: neoColors.primary
  },
  chipText: {
    color: neoColors.muted,
    fontWeight: "600"
  },
  chipTextActive: {
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
  hintText: {
    color: neoColors.muted,
    fontSize: 12
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
