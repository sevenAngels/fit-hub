import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";

import { supabase } from "@/infrastructure/supabase/client";

import type { AuthProfile, AuthResult, AuthState } from "@/features/auth/types";

function resolveOnboardingRequired(profile: AuthProfile | null): boolean {
  if (!profile) return true;
  const completed = profile.onboarding_completed === true;
  const hasHeight = typeof profile.height_cm === "number" && profile.height_cm > 0;
  const hasCurrentWeight =
    typeof profile.current_weight_kg === "number" && profile.current_weight_kg > 0;
  return !(completed && hasHeight && hasCurrentWeight);
}

function mapAuthError(errorMessage: string): string {
  if (errorMessage.includes("Email not confirmed")) {
    return "Email confirmation is required.";
  }
  if (errorMessage.includes("Invalid login credentials")) {
    return "Login failed. Check email and password.";
  }
  if (errorMessage.includes("already registered")) {
    return "This email is already registered.";
  }
  if (errorMessage.includes("Password should be at least 8 characters")) {
    return "Password must be at least 8 characters.";
  }
  return errorMessage;
}

function toAuthState(
  user: User | null,
  profile: AuthProfile | null,
  errorMessage: string | null = null
): AuthState {
  if (!user) {
    return {
      status: "unauthenticated",
      user: null,
      profile: null,
      onboardingRequired: false,
      errorMessage
    };
  }

  return {
    status: "authenticated",
    user,
    profile,
    onboardingRequired: resolveOnboardingRequired(profile),
    errorMessage
  };
}

export async function fetchAuthProfile(userId: string): Promise<AuthProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id,onboarding_completed,height_cm,current_weight_kg")
    .eq("user_id", userId)
    .maybeSingle<AuthProfile>();

  if (error) return null;
  return data;
}

export async function hydrateAuthStateFromSession(session: Session | null): Promise<AuthState> {
  if (!session?.user) {
    return toAuthState(null, null);
  }

  const profile = await fetchAuthProfile(session.user.id);
  return toAuthState(session.user, profile);
}

export async function getCurrentAuthState(): Promise<AuthState> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return {
      status: "unauthenticated",
      user: null,
      profile: null,
      onboardingRequired: false,
      errorMessage: mapAuthError(error.message)
    };
  }
  return hydrateAuthStateFromSession(data.session);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, errorMessage: mapAuthError(error.message) };
  }

  const { data } = await supabase.auth.getSession();
  const authState = await hydrateAuthStateFromSession(data.session);
  return { ok: true, redirectTo: authState.onboardingRequired ? "onboarding" : "dashboard" };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const emailRedirectTo = Linking.createURL("/callback");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo
    }
  });

  if (error) {
    return { ok: false, errorMessage: mapAuthError(error.message) };
  }
  return { ok: true, redirectTo: "signup-verify-email" };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const redirectTo = Linking.createURL("/callback");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  });
  if (error) {
    return { ok: false, errorMessage: mapAuthError(error.message) };
  }
  return { ok: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, errorMessage: mapAuthError(error.message) };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    await supabase.auth.signOut();
  }
}

function parseUrlParams(url: string): URLSearchParams {
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");

  if (hashIndex >= 0) {
    return new URLSearchParams(url.slice(hashIndex + 1));
  }
  if (queryIndex >= 0) {
    return new URLSearchParams(url.slice(queryIndex + 1));
  }
  return new URLSearchParams();
}

export async function applySessionFromDeepLink(url: string): Promise<AuthResult> {
  const params = parseUrlParams(url);

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const code = params.get("code");
  const type = params.get("type");
  const deepLinkError = params.get("error");
  const errorDescription = params.get("error_description");

  if (deepLinkError) {
    return { ok: false, errorMessage: decodeURIComponent(errorDescription ?? deepLinkError) };
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, errorMessage: mapAuthError(error.message) };
    }

    const { data } = await supabase.auth.getSession();
    const authState = await hydrateAuthStateFromSession(data.session);
    return {
      ok: true,
      redirectTo:
        type === "recovery" || type === "password_recovery"
          ? "reset-password"
          : authState.onboardingRequired
            ? "onboarding"
            : "dashboard"
    };
  }

  if (!accessToken || !refreshToken) {
    return { ok: false, errorMessage: "No auth token found in deep link." };
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    return { ok: false, errorMessage: mapAuthError(error.message) };
  }

  const { data } = await supabase.auth.getSession();
  const authState = await hydrateAuthStateFromSession(data.session);
  return {
    ok: true,
    redirectTo:
      type === "recovery" || type === "password_recovery"
        ? "reset-password"
        : authState.onboardingRequired
          ? "onboarding"
          : "dashboard"
  };
}
