import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

import { appEnv } from "@/infrastructure/config/env";
import { secureStoreAuthStorage } from "@/infrastructure/supabase/storage";

const STORAGE_KEY = "fithub-mobile-supabase-auth-token";

export const supabase = createClient(appEnv.EXPO_PUBLIC_SUPABASE_URL, appEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAuthStorage,
    storageKey: STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
