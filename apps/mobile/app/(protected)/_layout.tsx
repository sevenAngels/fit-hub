import { Redirect, Stack, usePathname } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";

export default function ProtectedLayout() {
  const { onboardingRequired } = useAuth();
  const pathname = usePathname();
  const isOnboardingRoute = pathname.startsWith("/(protected)/onboarding");

  if (onboardingRequired && !isOnboardingRoute) {
    return <Redirect href="/(protected)/onboarding" />;
  }

  if (!onboardingRequired && isOnboardingRoute) {
    return <Redirect href="/(protected)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
