import { Redirect } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";

export default function IndexPage() {
  const { isAuthenticated, onboardingRequired } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  if (onboardingRequired) {
    return <Redirect href="/(protected)/onboarding" />;
  }

  return <Redirect href="/(protected)" />;
}
