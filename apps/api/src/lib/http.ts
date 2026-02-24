import { NextResponse } from "next/server";

export class ApiRouteError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message
      }
    },
    { status }
  );
}

export function toApiError(error: unknown, fallbackCode = "INTERNAL_ERROR", fallbackMessage = "Internal server error") {
  if (error instanceof ApiRouteError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiRouteError(500, fallbackCode, error.message || fallbackMessage);
  }

  return new ApiRouteError(500, fallbackCode, fallbackMessage);
}

export function isYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function randomSuffix(length = 8) {
  return Math.random().toString(36).slice(2, 2 + length);
}
