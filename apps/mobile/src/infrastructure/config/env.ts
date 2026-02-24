import { z } from "zod";

const envSchema = z
  .object({
    EXPO_PUBLIC_APP_ENV: z.enum(["dev", "staging", "prod"]),
    EXPO_PUBLIC_SUPABASE_URL: z.url(),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    EXPO_PUBLIC_API_BASE_URL: z.url(),
    EXPO_PUBLIC_WEB_BASE_URL: z.url().optional(),
    EXPO_PUBLIC_SENTRY_DSN: z.url().optional(),
    EXPO_PUBLIC_ANALYTICS_PROVIDER: z.enum(["none", "posthog"]).default("none"),
    EXPO_PUBLIC_POSTHOG_API_KEY: z.string().optional(),
    EXPO_PUBLIC_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
    EXPO_PUBLIC_HEALTH_FEATURE_ENABLED: z.enum(["true", "false"]).default("false"),
    EXPO_PUBLIC_HEALTH_ENABLED: z.enum(["true", "false"]).optional(),
    EXPO_PUBLIC_HEALTH_IOS: z.enum(["true", "false"]).optional(),
    EXPO_PUBLIC_HEALTH_ANDROID: z.enum(["true", "false"]).optional()
  })
  .superRefine((values, ctx) => {
    if (values.EXPO_PUBLIC_ANALYTICS_PROVIDER === "posthog" && !values.EXPO_PUBLIC_POSTHOG_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["EXPO_PUBLIC_POSTHOG_API_KEY"],
        message: "EXPO_PUBLIC_POSTHOG_API_KEY is required when EXPO_PUBLIC_ANALYTICS_PROVIDER=posthog"
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid mobile env config: ${message}`);
}

export const appEnv = parsed.data;

function parseHealthFlag(flag: string | undefined, fallback: string): boolean {
  return (flag ?? fallback) === "true";
}

const legacyHealthFlag = appEnv.EXPO_PUBLIC_HEALTH_FEATURE_ENABLED;

export const healthFlags = {
  enabled: parseHealthFlag(appEnv.EXPO_PUBLIC_HEALTH_ENABLED, legacyHealthFlag),
  ios: parseHealthFlag(appEnv.EXPO_PUBLIC_HEALTH_IOS, appEnv.EXPO_PUBLIC_HEALTH_ENABLED || legacyHealthFlag),
  android: parseHealthFlag(appEnv.EXPO_PUBLIC_HEALTH_ANDROID, appEnv.EXPO_PUBLIC_HEALTH_ENABLED || legacyHealthFlag),
};

export const telemetryConfig = {
  sentryDsn: appEnv.EXPO_PUBLIC_SENTRY_DSN,
  analyticsProvider: appEnv.EXPO_PUBLIC_ANALYTICS_PROVIDER,
  posthogApiKey: appEnv.EXPO_PUBLIC_POSTHOG_API_KEY,
  posthogHost: appEnv.EXPO_PUBLIC_POSTHOG_HOST
};
