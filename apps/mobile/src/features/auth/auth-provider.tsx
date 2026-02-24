import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus, View, ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/infrastructure/supabase/client";
import { queryClient } from "@/infrastructure/query/client";
import { hydrateAuthStateFromSession, signOut as signOutSession } from "@/features/auth/service";
import { queryPersister } from "@/infrastructure/query/persistor";
import { captureHandledError, trackTelemetryEvent } from "@/infrastructure/telemetry/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  onboardingRequired: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  signOut: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const QUERY_CACHE_KEY = "fit-hub-query-cache";
const ONBOARDING_DRAFT_KEY = "onboarding-draft-v1";

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  const refreshAuthState = useCallback(async () => {
    const {
      data: { session: currentSession },
      error
    } = await supabase.auth.getSession();

    const authState = await hydrateAuthStateFromSession(currentSession);

    if (error || authState.errorMessage) {
      captureHandledError("auth.refresh", new Error(error?.message ?? authState.errorMessage ?? "Refresh failed"), {
        has_session: Boolean(currentSession)
      });
    }

    setSession(currentSession);
    setOnboardingRequired(authState.onboardingRequired);
    setErrorMessage(error?.message ?? authState.errorMessage);
  }, []);

  const clearClientCaches = useCallback(async () => {
    queryClient.clear();
    await Promise.all([
      queryPersister.removeClient(),
      AsyncStorage.removeItem(QUERY_CACHE_KEY),
      AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY)
    ]);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutSession();
      trackTelemetryEvent("auth.signout", { source: "user_action_or_guard" });
    } catch (error) {
      captureHandledError("auth.signout", error, {});
      throw error;
    } finally {
      await clearClientCaches();
      setSession(null);
      setOnboardingRequired(false);
      setErrorMessage(null);
    }
  }, [clearClientCaches]);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const {
        data: { session: currentSession },
        error
      } = await supabase.auth.getSession();

      const authState = await hydrateAuthStateFromSession(currentSession);

      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        captureHandledError("auth.hydrate", error, {});
      }

      setSession(currentSession);
      setOnboardingRequired(authState.onboardingRequired);
      setErrorMessage(authState.errorMessage);
      setIsLoading(false);
    };

    hydrateSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        setOnboardingRequired(false);
        setErrorMessage(null);
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        void hydrateAuthStateFromSession(nextSession).then((nextAuthState) => {
          setOnboardingRequired(nextAuthState.onboardingRequired);
          setErrorMessage(nextAuthState.errorMessage);

          if (nextAuthState.errorMessage) {
            captureHandledError("auth.state_change", new Error(nextAuthState.errorMessage), {
              event
            });
          }
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        supabase.auth.startAutoRefresh();
        void supabase.auth.getSession().then(({ error }) => {
          if (error) {
            setErrorMessage(error.message);
            captureHandledError("auth.session_active_check", error, {});
            void signOut();
          }
        });
      } else if (nextAppState.match(/inactive|background/)) {
        supabase.auth.stopAutoRefresh();
      }

      appState.current = nextAppState;
    };

    const listener = AppState.addEventListener("change", onAppStateChange);

    return () => {
      listener.remove();
    };
  }, [signOut]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      onboardingRequired,
      isLoading,
      errorMessage,
      signOut,
      refreshAuthState
    }),
    [session, onboardingRequired, isLoading, errorMessage, signOut, refreshAuthState]
  );

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  }
});
