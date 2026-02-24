import type { User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthProfile = {
  user_id: string;
  onboarding_completed: boolean | null;
  height_cm: number | null;
  current_weight_kg: number | null;
};

export type AuthState = {
  status: AuthStatus;
  user: User | null;
  profile: AuthProfile | null;
  onboardingRequired: boolean;
  errorMessage: string | null;
};

export type AuthResult = {
  ok: boolean;
  errorMessage?: string;
  redirectTo?: "onboarding" | "dashboard" | "signup-verify-email" | "reset-password";
};
