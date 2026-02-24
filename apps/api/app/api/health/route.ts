import { ok } from "@/src/lib/http";

export const runtime = "nodejs";
export const maxDuration = 5;

export async function GET() {
  return ok({
    status: "ok",
    ts: Date.now()
  });
}
