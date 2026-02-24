import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const evidenceDir = join(repoRoot, ".sisyphus", "evidence");
const happyEvidencePath = join(evidenceDir, "task-25-healthkit-permission.json");
const errorEvidencePath = join(evidenceDir, "task-25-healthkit-permission-error.json");

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
  return {
    name,
    status: content.includes(value) ? "passed" : "failed",
    details: content.includes(value) ? `${value} found in ${filePath}` : `${value} missing in ${filePath}`
  };
}

function excludesCheck(content, value, name, filePath) {
  return {
    name,
    status: content.includes(value) ? "failed" : "passed",
    details: content.includes(value)
      ? `${value} must not appear in ${filePath}`
      : `${value} not present in ${filePath}`
  };
}

function buildStaticChecks() {
  const appJson = readFile("apps/mobile/app.json");
  const healthService = readFile("apps/mobile/src/features/health/service.ts");
  const healthScreen = readFile("apps/mobile/app/(protected)/health.tsx");
  const rootLayout = readFile("apps/mobile/app/_layout.tsx");
  const dashboard = readFile("apps/mobile/app/(protected)/index.tsx");

  return [
    includesCheck(appJson, "NSHealthShareUsageDescription", "ios_health_share_usage_configured", "apps/mobile/app.json"),
    includesCheck(appJson, "NSHealthUpdateUsageDescription", "ios_health_update_usage_configured", "apps/mobile/app.json"),
    includesCheck(healthService, "notDetermined", "permission_state_not_determined", "apps/mobile/src/features/health/service.ts"),
    includesCheck(healthService, "denied", "permission_state_denied", "apps/mobile/src/features/health/service.ts"),
    includesCheck(healthService, "revoked", "permission_state_revoked", "apps/mobile/src/features/health/service.ts"),
    includesCheck(healthService, "granted", "permission_state_granted", "apps/mobile/src/features/health/service.ts"),
    includesCheck(healthScreen, "Connect HealthKit", "health_rationale_connect_cta", "apps/mobile/app/(protected)/health.tsx"),
    includesCheck(healthScreen, "Open iOS Settings", "health_recovery_settings_cta", "apps/mobile/app/(protected)/health.tsx"),
    excludesCheck(rootLayout, "requestAuthorization", "startup_does_not_prompt_health_authorization", "apps/mobile/app/_layout.tsx"),
    includesCheck(dashboard, "/(protected)/health", "dashboard_has_health_entry", "apps/mobile/app/(protected)/index.tsx")
  ];
}

function buildHappyEvidence(checks, reason) {
  return {
    task: "T25",
    scenario: "HealthKit permission granted",
    generated_at: nowIso(),
    status: reason ? "not_run" : checks.some((check) => check.status === "failed") ? "fail" : "pass_static",
    platform: "iOS",
    metadata: {
      runtime_check_reason: reason || "runtime checks not executed",
      notes: "Static checks validate lifecycle states, in-app rationale/recovery CTAs, entitlement usage keys, and startup non-blocking guard."
    },
    summary: summarize(checks),
    checks
  };
}

function buildErrorEvidence() {
  const checks = [
    {
      name: "permission_denied_or_revoked_runtime",
      status: "skipped",
      details: "Denied/revoked runtime scenario requires iOS device with HealthKit permission toggling"
    }
  ];

  return {
    task: "T25",
    scenario: "HealthKit permission denied or revoked",
    generated_at: nowIso(),
    status: "not_run",
    platform: "iOS",
    metadata: {
      reason: "Runtime device QA deferred",
      required_followup: "Run denied/revoked flow on iOS device and capture settings-recovery + non-blocking core UX evidence."
    },
    summary: summarize(checks),
    checks
  };
}

function main() {
  ensureEvidenceDir();

  const checks = buildStaticChecks();
  const reason = dryRun ? "dry-run mode" : "runtime HealthKit device permission flow pending";

  const happyEvidence = buildHappyEvidence(checks, reason);
  const errorEvidence = buildErrorEvidence();

  writeFileSync(happyEvidencePath, JSON.stringify(happyEvidence, null, 2));
  writeFileSync(errorEvidencePath, JSON.stringify(errorEvidence, null, 2));

  if (checks.some((check) => check.status === "failed")) {
    console.error("T25 healthkit permission static checks failed.");
    process.exit(1);
  }

  console.log("T25 healthkit permission evidence generated.");
}

main();
