import {
  FileState,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
  createPartFromBase64,
  createPartFromUri
} from "@google/genai";
import { z } from "zod";

import { getEnv } from "@/src/lib/env";

let aiClient: GoogleGenAI | null = null;

const scoreSchema = z.enum(["perfect", "good", "bad"]);

const mealSchema = z.object({
  isFood: z.boolean(),
  foodName: z.string().min(1),
  foodNameEn: z.string().min(1),
  totalCalories: z.number().nonnegative(),
  totalCarbohydratesG: z.number().nonnegative(),
  totalProteinG: z.number().nonnegative(),
  totalFatG: z.number().nonnegative(),
  aiReview: z.string().min(1).max(80),
  aiScore: scoreSchema,
  confidence: z.number().min(0).max(1)
});

const feedbackSchema = z.object({
  feedbackText: z.string().min(1).max(120),
  highlights: z.array(z.string().min(1)).max(3),
  suggestions: z.array(z.string().min(1)).max(3)
});

export type MealAnalysisResult = z.infer<typeof mealSchema>;
export type FeedbackResult = z.infer<typeof feedbackSchema>;

export type MealAnalysisInput = {
  mealType: string;
  mimeType: string;
  base64Image?: string;
};

export type FeedbackInput = {
  nickname: string;
  programGoal: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  targetCalories: number;
};

const mealResponseSchema = {
  type: Type.OBJECT,
  properties: {
    isFood: { type: Type.BOOLEAN },
    foodName: { type: Type.STRING },
    foodNameEn: { type: Type.STRING },
    totalCalories: { type: Type.NUMBER, minimum: 0 },
    totalCarbohydratesG: { type: Type.NUMBER, minimum: 0 },
    totalProteinG: { type: Type.NUMBER, minimum: 0 },
    totalFatG: { type: Type.NUMBER, minimum: 0 },
    aiReview: { type: Type.STRING },
    aiScore: { type: Type.STRING, enum: ["perfect", "good", "bad"] },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 }
  },
  required: [
    "isFood",
    "foodName",
    "foodNameEn",
    "totalCalories",
    "totalCarbohydratesG",
    "totalProteinG",
    "totalFatG",
    "aiReview",
    "aiScore",
    "confidence"
  ],
  propertyOrdering: [
    "isFood",
    "foodName",
    "foodNameEn",
    "totalCalories",
    "totalCarbohydratesG",
    "totalProteinG",
    "totalFatG",
    "aiReview",
    "aiScore",
    "confidence"
  ]
} as const;

const feedbackResponseSchema = {
  type: Type.OBJECT,
  properties: {
    feedbackText: { type: Type.STRING },
    highlights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: 1,
      maxItems: 3
    },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: 1,
      maxItems: 3
    }
  },
  required: ["feedbackText", "highlights", "suggestions"],
  propertyOrdering: ["feedbackText", "highlights", "suggestions"]
} as const;

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE }
];

function getClient() {
  const env = getEnv();
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: env.GOOGLE_GEMINI_API_KEY });
  }

  return aiClient;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonText(value: string, fallbackLabel: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fallbackLabel} response contained no text.`);
  }

  const cleaned = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  return JSON.parse(cleaned);
}

function extractJsonFromResponse(response: unknown, operation: string) {
  if (typeof response !== "object" || response === null) {
    throw new Error(`${operation} did not return an object response.`);
  }

  const typed = response as Record<string, unknown>;

  if (typed.parsed !== undefined) {
    if (typeof typed.parsed === "string") {
      return parseJsonText(typed.parsed, operation);
    }
    return typed.parsed;
  }

  if (typeof typed.text === "string") {
    return parseJsonText(typed.text, operation);
  }

  const candidates = typed.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const firstCandidate = candidates[0] as { content?: { parts?: Array<{ text?: unknown }> } };
    const text = firstCandidate?.content?.parts?.find((part) => typeof part?.text === "string")?.text;
    if (typeof text === "string") {
      return parseJsonText(text, operation);
    }
  }

  throw new Error(`${operation} response format is not parseable as JSON.`);
}

function getTimeoutMessage(operation: string, timeoutMs: number) {
  return `${operation} request timed out after ${timeoutMs}ms.`;
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(getTimeoutMessage("Gemini", timeoutMs)));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

type GenerateWithSchemaOptions<T> = {
  model: string;
  contents: unknown;
  operation: string;
  responseSchema: Record<string, unknown>;
  resultSchema: z.ZodType<T>;
  maxOutputTokens?: number;
  temperature?: number;
};

async function generateWithSchema<T>({
  model,
  contents,
  responseSchema,
  resultSchema,
  operation,
  maxOutputTokens = 512,
  temperature = 0.2
}: GenerateWithSchemaOptions<T>): Promise<T> {
  const client = getClient();
  const env = getEnv();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= env.GEMINI_HTTP_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: contents as never,
          config: {
            responseMimeType: "application/json",
            responseSchema,
            safetySettings,
            temperature,
            maxOutputTokens
          } as never
        }),
        env.GEMINI_HTTP_TIMEOUT_MS
      );

      const parsedRaw = extractJsonFromResponse(response, operation);
      return resultSchema.parse(parsedRaw);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`${operation} failed`);
      if (attempt < env.GEMINI_HTTP_RETRY_ATTEMPTS) {
        await sleep(200 * attempt);
      }
    }
  }

  throw lastError ?? new Error(`${operation} failed.`);
}

type ImagePayload = {
  base64Image: string;
  mimeType: string;
};

function toBlob(data: ImagePayload) {
  const buffer = Buffer.from(data.base64Image, "base64");
  return new Blob([buffer], { type: data.mimeType });
}

function getFileUri(file: unknown): string | null {
  if (typeof file !== "object" || file === null) {
    return null;
  }

  const typed = file as Record<string, unknown>;
  if (typeof typed.uri === "string" && typed.uri.length > 0) {
    return typed.uri;
  }

  if (typeof typed.name === "string" && typed.name.length > 0) {
    return typed.name;
  }

  return null;
}

function getFileName(file: unknown): string | null {
  if (typeof file !== "object" || file === null) {
    return null;
  }

  const typed = file as Record<string, unknown>;
  return typeof typed.name === "string" ? typed.name : null;
}

async function waitForUploadedFile(fileName: string, timeoutMs: number) {
  const client = getClient();
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const info = await client.files.get({ name: fileName } as never);
    if (!info || typeof info !== "object") {
      return;
    }

    const currentState = (info as Record<string, unknown>).state;
    if (currentState === FileState.ACTIVE || currentState === undefined) {
      return;
    }

    if (currentState === FileState.FAILED) {
      throw new Error("Uploaded file failed to process.");
    }

    await sleep(500);
  }

  throw new Error("Uploaded file failed to become active before timeout.");
}

async function cleanupUploadedFile(fileName: string) {
  try {
    const client = getClient();
    await client.files.delete({ name: fileName } as never);
  } catch {}
}

async function createImagePart(input: ImagePayload) {
  const env = getEnv();
  if (input.base64Image.length <= env.GEMINI_MEAL_IMAGE_INLINE_BYTES) {
    return {
      part: createPartFromBase64(input.base64Image, input.mimeType),
      cleanup: null as (() => Promise<void>) | null
    };
  }

  const blob = toBlob(input);
  const uploadedFile = await getClient().files.upload({
    file: blob,
    config: {
      mimeType: input.mimeType
    } as never
  } as never);

  const fileName = getFileName(uploadedFile);
  const fileUri = getFileUri(uploadedFile);

  if (!fileName || !fileUri) {
    throw new Error("Uploaded file is missing name or URI.");
  }

  await waitForUploadedFile(fileName, Math.max(env.GEMINI_HTTP_TIMEOUT_MS, 30_000));

  return {
    part: createPartFromUri(fileUri, input.mimeType),
    cleanup: async () => {
      await cleanupUploadedFile(fileName);
    }
  };
}

export async function analyzeMealImage(input: MealAnalysisInput): Promise<MealAnalysisResult> {
  const env = getEnv();
  if (!input.base64Image) {
    throw new Error("base64Image is required for meal analysis.");
  }

  const payload = await createImagePart({
    base64Image: input.base64Image,
    mimeType: input.mimeType
  });

  try {
    return await generateWithSchema<MealAnalysisResult>({
      model: env.GEMINI_MODEL_MEAL,
      operation: "meal analysis",
      responseSchema: mealResponseSchema,
      resultSchema: mealSchema,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Analyze the meal image and return JSON only.",
                `Meal type: ${input.mealType}`,
                'Required JSON schema: {"isFood": boolean, "foodName": string, "foodNameEn": string, "totalCalories": number, "totalCarbohydratesG": number, "totalProteinG": number, "totalFatG": number, "aiReview": string, "aiScore": "perfect|good|bad", "confidence": number}',
                'Rules: if not food, isFood=false and nutrient values should be 0.',
                "Return concise Korean aiReview suitable for app display."
              ].join("\n")
            },
            payload.part
          ]
        }
      ]
    });
  } finally {
    if (payload.cleanup) {
      await payload.cleanup();
    }
  }
}

export async function generateFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const env = getEnv();
  return await generateWithSchema<FeedbackResult>({
    model: env.GEMINI_MODEL_FEEDBACK,
    operation: "feedback generation",
    responseSchema: feedbackResponseSchema,
    resultSchema: feedbackSchema,
    contents: [
      "Generate concise nutrition feedback in Korean.",
      `Nickname: ${input.nickname}`,
      `Goal: ${input.programGoal}`,
      `Today total calories: ${input.totalCalories}`,
      `Total protein g: ${input.totalProtein}`,
      `Total carbs g: ${input.totalCarbs}`,
      `Total fat g: ${input.totalFat}`,
      `Target calories: ${input.targetCalories}`,
      "Reply as JSON matching schema: {feedbackText, highlights, suggestions}",
      "highlights and suggestions should contain up to 3 short practical items."
    ].join("\n")
  });
}
