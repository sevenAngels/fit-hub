import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  pickAvatarImage,
  useUpdateProfileMutation,
  useUploadProfileAvatarMutation,
  useUserProfile
} from "@/features/profile/queries";
import { useCreateCheckoutSessionMutation, useSubscriptionStatus } from "@/features/subscription/queries";

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

      <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(protected)")}>
        <Text style={styles.secondaryLabel}>Back to dashboard</Text>
      </Pressable>

      {profileQuery.isLoading ? <ActivityIndicator size="small" color="#2f6fa8" /> : null}
      {profileQuery.error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{profileQuery.error.message}</Text>
          <Pressable style={styles.retryButton} onPress={() => void profileQuery.refetch()}>
            <Text style={styles.retryLabel}>Retry load</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.subscriptionRow}>
          <Text style={styles.subscriptionLabel}>Status</Text>
          <Text style={[styles.subscriptionBadge, subscriptionStatus?.isActive ? styles.subscriptionActive : styles.subscriptionInactive]}>
            {subscriptionLabel}
          </Text>
        </View>

        <Text style={styles.subscriptionText}>Plan: {planName}</Text>
        <Text style={styles.subscriptionText}>Renews: {renewalDate}</Text>

        {subscriptionQuery.isLoading ? <ActivityIndicator size="small" color="#2f6fa8" /> : null}
        {subscriptionQuery.error ? <Text style={styles.subscriptionError}>{subscriptionQuery.error.message}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={() => void startCheckout()} disabled={isBusy}>
          <Text style={styles.primaryLabel}>
            {checkoutMutation.isPending ? "Opening checkout..." : subscriptionStatus?.isActive ? "Manage subscription" : "Upgrade subscription"}
          </Text>
        </Pressable>

        <Text style={styles.hintText}>Subscription checkout uses web flow for this MVP.</Text>
        {billingMessage ? <Text style={styles.billingMessage}>{billingMessage}</Text> : null}
      </View>

      <View style={styles.card}>
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

        <Pressable style={styles.primaryButton} onPress={() => void uploadAvatar()} disabled={isBusy}>
          <Text style={styles.primaryLabel}>{uploadAvatarMutation.isPending ? "Uploading..." : "Upload avatar"}</Text>
        </Pressable>
        <Text style={styles.hintText}>Supported: JPG, PNG, WebP, GIF, HEIC, HEIF (max 10MB)</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile Info</Text>

        <Text style={styles.fieldLabel}>Nickname</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          maxLength={6}
          placeholder="Nickname"
          editable={!isBusy}
        />

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput style={[styles.input, styles.disabledInput]} value={email} editable={false} />

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

        <Pressable style={styles.primaryButton} onPress={() => void submitProfile()} disabled={isBusy}>
          <Text style={styles.primaryLabel}>{updateProfileMutation.isPending ? "Saving..." : "Save profile"}</Text>
        </Pressable>
      </View>

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
  subscriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  subscriptionLabel: {
    color: "#4f5f76",
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
    borderColor: "#2e7d32",
    backgroundColor: "#e8f5e9",
    color: "#1e6b2d"
  },
  subscriptionInactive: {
    borderColor: "#b00020",
    backgroundColor: "#ffebee",
    color: "#8b0015"
  },
  subscriptionText: {
    color: "#4f5f76"
  },
  subscriptionError: {
    color: "#b00020"
  },
  billingMessage: {
    color: "#8b0015"
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
    borderColor: "#cfd8e3"
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d9e7f3"
  },
  avatarFallbackText: {
    fontSize: 32,
    color: "#23486a",
    fontWeight: "700"
  },
  fieldLabel: {
    color: "#4f5f76",
    fontWeight: "600"
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  disabledInput: {
    color: "#6f8092",
    backgroundColor: "#edf2f7"
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#91a5ba",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff"
  },
  chipActive: {
    borderColor: "#2f6fa8",
    backgroundColor: "#2f6fa8"
  },
  chipText: {
    color: "#39536e",
    fontWeight: "600"
  },
  chipTextActive: {
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
  hintText: {
    color: "#4f5f76",
    fontSize: 12
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
