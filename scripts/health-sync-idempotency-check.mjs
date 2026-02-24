import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const evidenceDir = join(repoRoot, ".sisyphus", "evidence");

const happyEvidencePath = join(evidenceDir, "task-27-sync-idempotency.json");
const errorEvidencePath = join(evidenceDir, "task-27-sync-idempotency-error.json");

const dryRun = process.argv.includes("--dry-run");

function nowIso() {
  return new Date().toISOString();
}

function ensureEvidenceDir() {
  mkdirSync(evidenceDir, { recursive: true });
}

function readFile(filePath) {
  return readFileSync(join(repoRoot, filePath), "utf8");
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

function includesCheck(content, value, name, filePath) {
  const exists = content.includes(value);
  return {
    name,
    status: exists ? "passed" : "failed",
    details: exists ? `${value} found in ${filePath}` : `${value} missing in ${filePath}`
  };
}

function excludesCheck(content, value, name, filePath) {
  const exists = content.includes(value);
  return {
    name,
    status: exists ? "failed" : "passed",
    details: exists ? `${value} must not appear in ${filePath}` : `${value} not present in ${filePath}`
  };
}

function buildStaticChecks() {
  const syncEngine = readFile("apps/mobile/src/features/health/sync-engine.ts");
  const rootLayout = readFile("apps/mobile/app/_layout.tsx");

  return [
    includesCheck(syncEngine, "runtimeGuard", "overlap_guard_runtime_present", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(syncEngine, "lastStartAt", "last_start_timestamp_guard_present", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(syncEngine, "is_running", "sync_state_running_flag_present", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(syncEngine, "changesTokenExpired", "token_expired_handling_present", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(syncEngine, "commitDailyMetricsWindow", "window_commit_function_present", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(syncEngine, "onConflict: \"user_id,platform,local_date,source\"", "idempotent_upsert_conflict_key", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(syncEngine, "splitByLocalMidnight", "midnight_split_function_present", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(syncEngine, "tz_offset_min", "tz_offset_persisted", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(syncEngine, "runDeferredHealthSync", "deferred_sync_entrypoint_present", "apps/mobile/src/features/health/sync-engine.ts"),
    includesCheck(rootLayout, "setTimeout(() =>", "startup_deferred_trigger_present", "apps/mobile/app/_layout.tsx"),
    includesCheck(rootLayout, "runDeferredHealthSync(\"startup_post_auth\")", "startup_post_auth_trigger_wired", "apps/mobile/app/_layout.tsx"),
    excludesCheck(rootLayout, "await runDeferredHealthSync", "startup_not_blocked_by_sync", "apps/mobile/app/_layout.tsx")
  ];
}

function buildHappyEvidence(checks, reason) {
  return {
    task: "T27",
    scenario: "Idempotent sync rerun",
    generated_at: nowIso(),
    status: reason ? "not_run" : checks.some((check) => check.status === "failed") ? "fail" : "pass_static",
    platform: "iOS + Android",
    metadata: {
      runtime_check_reason: reason || "runtime checks not executed",
      notes: "Static checks validate deferred trigger, overlap guard, reset handling, deterministic conflict target, and day-boundary normalization hooks."
    },
    summary: summarize(checks),
    checks
  };
}

function buildErrorEvidence() {
  const checks = [
    {
      name: "startup_regression_runtime",
      status: "skipped",
      details: "Cold-start deferred sync runtime scenario requires device instrumentation"
    }
  ];

  return {
    task: "T27",
    scenario: "Startup path regression",
    generated_at: nowIso(),
    status: "not_run",
    platform: "iOS + Android",
    metadata: {
      reason: "Runtime device QA deferred",
      required_followup: "Measure first meaningful render with health sync enabled and verify sync starts only after render path is ready."
    },
    summary: summarize(checks),
    checks
  };
}

function main() {
  ensureEvidenceDir();

  const checks = buildStaticChecks();
  const reason = dryRun ? "dry-run mode" : "runtime idempotent rerun and startup timing checks pending";

  writeFileSync(happyEvidencePath, JSON.stringify(buildHappyEvidence(checks, reason), null, 2));
  writeFileSync(errorEvidencePath, JSON.stringify(buildErrorEvidence(), null, 2));

  if (checks.some((check) => check.status === "failed")) {
    console.error("T27 health sync idempotency static checks failed.");
    process.exit(1);
  }

  console.log("T27 health sync idempotency evidence generated.");
}

main();
