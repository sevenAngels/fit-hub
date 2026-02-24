import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const evidenceDir = join(repoRoot, ".sisyphus", "evidence");

const happyEvidencePath = join(evidenceDir, "task-21-observability.json");
const failureEvidencePath = join(evidenceDir, "task-21-observability-error.json");

const dryRun = process.argv.includes("--dry-run");

function nowIso() {
  return new Date().toISOString();
}

function ensureDir() {
  mkdirSync(evidenceDir, { recursive: true });
}

function writeJson(pathValue, data) {
  ensureDir();
  writeFileSync(pathValue, JSON.stringify(data, null, 2));
}

function summarize(checks) {
  const passed = checks.filter((check) => check.status === "passed").length;
  const failed = checks.filter((check) => check.status === "failed").length;
  const skipped = checks.filter((check) => check.status === "skipped").length;

  return {
    passed,
    failed,
    skipped,
    total: checks.length
  };
}

function checkContains(filePath, pattern, name) {
  const absolutePath = join(repoRoot, filePath);
  if (!existsSync(absolutePath)) {
    return {
      name,
      status: "failed",
      details: `${filePath} not found`
    };
  }

  const content = readFileSync(absolutePath, "utf8");
  if (content.includes(pattern)) {
    return {
      name,
      status: "passed",
      details: `${pattern} found in ${filePath}`
    };
  }

  return {
    name,
    status: "failed",
    details: `${pattern} missing in ${filePath}`
  };
}

function buildStaticChecks() {
  return [
    checkContains(
      "apps/mobile/src/infrastructure/telemetry/client.ts",
      "initializeTelemetry",
      "telemetry_client_exists"
    ),
    checkContains(
      "apps/mobile/app/_layout.tsx",
      "markStartupReady",
      "startup_metric_hooked"
    ),
    checkContains(
      "apps/mobile/src/infrastructure/api/client.ts",
      "trackApiRequestMetric",
      "api_error_rate_hooked"
    ),
    checkContains(
      "apps/mobile/src/features/record/upload-adapter.ts",
      "trackUploadMetric",
      "upload_latency_hooked"
    ),
    checkContains(
      "apps/mobile/src/infrastructure/telemetry/client.ts",
      "trackHealthTelemetrySnapshot",
      "health_telemetry_hooked"
    )
  ];
}

function buildHappyEvidence(checks, reason) {
  return {
    scenario: "metrics_pipeline_active",
    generated_at: nowIso(),
    status: reason ? "not_run" : checks.some((check) => check.status === "failed") ? "fail" : "pass_static",
    metadata: {
      runtime_check_reason: reason || "runtime checks not executed",
      notes: "Static instrumentation checks only. Runtime ingestion verification remains pending."
    },
    summary: summarize(checks),
    checks
  };
}

function buildFailureEvidence(reason) {
  const checks = [
    {
      name: "crash_capture_synthetic",
      status: "skipped",
      details: reason
    }
  ];

  return {
    scenario: "crash_capture_disabled",
    generated_at: nowIso(),
    status: "not_run",
    metadata: {
      reason,
      required_followup: "Run staging crash hook and verify Sentry alert pipeline."
    },
    summary: summarize(checks),
    checks
  };
}

function main() {
  const checks = buildStaticChecks();

  const happyReason = dryRun
    ? "dry-run mode"
    : "runtime telemetry backend query step not configured in local environment";

  const happyEvidence = buildHappyEvidence(checks, happyReason);
  const failureEvidence = buildFailureEvidence("Crash hook scenario deferred to staging runtime");

  writeJson(happyEvidencePath, happyEvidence);
  writeJson(failureEvidencePath, failureEvidence);

  if (checks.some((check) => check.status === "failed")) {
    console.error("T21 static observability checks failed.");
    process.exit(1);
  }

  console.log("T21 observability evidence generated.");
}

main();
