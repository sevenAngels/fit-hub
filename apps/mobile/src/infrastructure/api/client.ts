import { appEnv } from "@/infrastructure/config/env";
import { supabase } from "@/infrastructure/supabase/client";
import { captureHandledError, trackApiRequestMetric } from "@/infrastructure/telemetry/client";

export type ApiRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiClientError = {
  status: number;
  code: "unauthorized" | "forbidden" | "timeout" | "network" | "unknown";
  message: string;
};

export type ApiRequestOptions = {
  method?: ApiRequestMethod;
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
  timeoutMs?: number;
  retries?: number;
  idempotencyKey?: string;
};

export type MultipartOptions = {
  formData: FormData;
  headers?: Record<string, string>;
  requireAuth?: boolean;
  timeoutMs?: number;
  idempotencyKey?: string;
  onProgress?: (progress: number) => void;
};

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${appEnv.EXPO_PUBLIC_API_BASE_URL}${normalizedPath}`;
}

async function getAccessTokenOrThrow(requireAuth: boolean): Promise<string | null> {
  if (!requireAuth) {
    return null;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw {
      status: 401,
      code: "unauthorized",
      message: "Authentication required"
    } satisfies ApiClientError;
  }

  return session.access_token;
}

function mapError(status: number, fallbackMessage: string): ApiClientError {
  if (status === 401) {
    return { status, code: "unauthorized", message: "Authentication is required." };
  }
  if (status === 403) {
    return { status, code: "forbidden", message: "You do not have access to this resource." };
  }
  return { status, code: "unknown", message: fallbackMessage };
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    headers,
    requireAuth = true,
    timeoutMs = 10_000,
    retries = 0,
    idempotencyKey
  } = options;

  const token = await getAccessTokenOrThrow(requireAuth);

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    ...(headers ?? {})
  };

  let lastError: ApiClientError | null = null;
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(buildUrl(path), {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as unknown) : null;

      if (!response.ok) {
        const message =
          typeof parsed === "object" && parsed !== null && "error" in parsed
            ? String((parsed as { error: unknown }).error)
            : `Request failed with status ${response.status}`;
        lastError = mapError(response.status, message);

        if (attempt === retries) {
          trackApiRequestMetric({
            path,
            method,
            status: response.status,
            durationMs: Date.now() - startedAt,
            attempts: attempt + 1,
            ok: false,
            errorCode: lastError.code
          });
        }

        continue;
      }

      trackApiRequestMetric({
        path,
        method,
        status: response.status,
        durationMs: Date.now() - startedAt,
        attempts: attempt + 1,
        ok: true
      });

      return parsed as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        lastError = { status: 408, code: "timeout", message: "Request timed out." };
      } else {
        lastError = { status: 0, code: "network", message: "Network request failed." };
      }

      if (attempt === retries) {
        trackApiRequestMetric({
          path,
          method,
          status: lastError.status,
          durationMs: Date.now() - startedAt,
          attempts: attempt + 1,
          ok: false,
          errorCode: lastError.code
        });
      }
    }
  }

  if (!lastError) {
    const unknownError = { status: 0, code: "unknown", message: "Unknown request failure." } satisfies ApiClientError;
    captureHandledError("api.request", new Error(unknownError.message), {
      path,
      method,
      status: unknownError.status,
      code: unknownError.code
    });
    throw unknownError;
  }

  captureHandledError("api.request", new Error(lastError.message), {
    path,
    method,
    status: lastError.status,
    code: lastError.code
  });

  throw lastError;
}

export async function apiMultipartRequest<T>(path: string, options: MultipartOptions): Promise<T> {
  const { formData, headers, requireAuth = true, timeoutMs = 30_000, idempotencyKey, onProgress } = options;
  const token = await getAccessTokenOrThrow(requireAuth);

  return new Promise<T>((resolve, reject) => {
    const startedAt = Date.now();
    const request = new XMLHttpRequest();
    request.open("POST", buildUrl(path));
    request.timeout = timeoutMs;
    request.setRequestHeader("Accept", "application/json");

    if (token) {
      request.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    if (idempotencyKey) {
      request.setRequestHeader("Idempotency-Key", idempotencyKey);
    }
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        request.setRequestHeader(key, value);
      });
    }

    request.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }
      onProgress(Math.max(0, Math.min(1, event.loaded / event.total)));
    };

    request.onerror = () => {
      const error = { status: 0, code: "network", message: "Upload failed due to network issue." } satisfies ApiClientError;
      trackApiRequestMetric({
        path,
        method: "POST",
        status: error.status,
        durationMs: Date.now() - startedAt,
        attempts: 1,
        ok: false,
        errorCode: error.code
      });
      captureHandledError("api.multipart", new Error(error.message), {
        path,
        status: error.status,
        code: error.code
      });
      reject(error);
    };

    request.ontimeout = () => {
      const error = { status: 408, code: "timeout", message: "Upload timed out." } satisfies ApiClientError;
      trackApiRequestMetric({
        path,
        method: "POST",
        status: error.status,
        durationMs: Date.now() - startedAt,
        attempts: 1,
        ok: false,
        errorCode: error.code
      });
      captureHandledError("api.multipart", new Error(error.message), {
        path,
        status: error.status,
        code: error.code
      });
      reject(error);
    };

    request.onload = () => {
      const status = request.status;
      const text = request.responseText;
      const payload = text ? (JSON.parse(text) as unknown) : null;

      if (status < 200 || status >= 300) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : `Request failed with status ${status}`;
        const mappedError = mapError(status, message);
        trackApiRequestMetric({
          path,
          method: "POST",
          status,
          durationMs: Date.now() - startedAt,
          attempts: 1,
          ok: false,
          errorCode: mappedError.code
        });
        captureHandledError("api.multipart", new Error(mappedError.message), {
          path,
          status,
          code: mappedError.code
        });
        reject(mappedError);
        return;
      }

      trackApiRequestMetric({
        path,
        method: "POST",
        status,
        durationMs: Date.now() - startedAt,
        attempts: 1,
        ok: true
      });

      resolve(payload as T);
    };

    request.send(formData);
  });
}

export const mobileApiClient = {
  request: apiRequest,
  multipart: apiMultipartRequest,
  uploadMeal: <T>(formData: FormData, idempotencyKey?: string, onProgress?: (progress: number) => void) =>
    apiMultipartRequest<T>("/api/meal/upload", {
      formData,
      requireAuth: true,
      idempotencyKey,
      onProgress,
      timeoutMs: 60_000
    }),
  uploadAvatar: <T>(formData: FormData) =>
    apiMultipartRequest<T>("/api/avatar/upload", {
      formData,
      requireAuth: true,
      timeoutMs: 60_000
    }),
  feedbackGenerate: <T>(payload: unknown, idempotencyKey?: string) =>
    apiRequest<T>("/api/feedback/generate", {
      method: "POST",
      body: payload,
      requireAuth: true,
      timeoutMs: 20_000,
      retries: 1,
      idempotencyKey
    }),
  feedbackLatest: <T>() => apiRequest<T>("/api/feedback/latest", { method: "GET", requireAuth: true, timeoutMs: 10_000 }),
  subscriptionStatus: <T>() =>
    apiRequest<T>("/api/subscription/status", {
      method: "GET",
      requireAuth: true,
      timeoutMs: 10_000
    })
};
