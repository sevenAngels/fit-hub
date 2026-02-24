import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL_MEAL: z.string().default("gemini-2.5-flash"),
  GEMINI_MODEL_FEEDBACK: z.string().default("gemini-2.5-flash-lite"),
  GEMINI_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  GEMINI_HTTP_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
  GEMINI_MEAL_IMAGE_INLINE_BYTES: z.coerce.number().int().positive().default(2_000_000),
  MEAL_IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  AVATAR_IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024)
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid api env config: ${message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
