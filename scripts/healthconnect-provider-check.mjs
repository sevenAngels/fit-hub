import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const evidenceDir = join(repoRoot, ".sisyphus", "evidence");

const happyEvidencePath = join(evidenceDir, "task-26-healthconnect-available.json");
const errorEvidencePath = join(evidenceDir, "task-26-healthconnect-available-error.json");

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
  const healthService = readFile("apps/mobile/src/features/health/service.ts");
  const healthScreen = readFile("apps/mobile/app/(protected)/health.tsx");
  const rootLayout = readFile("apps/mobile/app/_layout.tsx");
  const appJson = readFile("apps/mobile/app.json");

  return [
    includesCheck(healthService, "providerAvailability", "provider_available_branch_present", "apps/mobile/src/features/health/service.ts"),
    includesCheck(healthService, "providerVersion", "provider_version_branch_present", "apps/mobile/src/features/health/service.ts"),
    includesCheck(healthService, "requestPermission(", "request_permission_branch_present", "apps/mobile/src/features/health/service.ts"),
    includesCheck(
      healthService,
      "openAndroidHealthConnectInstallProvider",
      "install_provider_branch_present",
      "apps/mobile/src/features/health/service.ts"
    ),
    includesCheck(healthService, "token_expired", "token_expiry_error_handling_present", "apps/mobile/src/features/health/service.ts"),
    includesCheck(healthService, "readCheckState", "read_error_precheck_present", "apps/mobile/src/features/health/service.ts"),
    includesCheck(appJson, "android.permission.health.READ_STEPS", "android_permission_steps_declared", "apps/mobile/app.json"),
    includesCheck(
      appJson,
      "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
      "android_permission_active_calories_declared",
      "apps/mobile/app.json"
    ),
    includesCheck(appJson, "expo-health-connect", "expo_health_connect_plugin_configured", "apps/mobile/app.json"),
    includesCheck(healthScreen, "Install or update Health Connect", "android_install_update_guidance_ui", "apps/mobile/app/(protected)/health.tsx"),
    includesCheck(healthScreen, "Request Android permissions", "android_permission_request_ui", "apps/mobile/app/(protected)/health.tsx"),
    includesCheck(healthScreen, "Open Health Connect settings", "android_settings_recovery_ui", "apps/mobile/app/(protected)/health.tsx"),
    excludesCheck(rootLayout, "getSdkStatus(", "startup_no_android_provider_probe", "apps/mobile/app/_layout.tsx"),
    excludesCheck(rootLayout, "requestPermission(", "startup_no_android_permission_prompt", "apps/mobile/app/_layout.tsx")
  ];
}

function buildHappyEvidence(checks, reason) {
  return {
    task: "T26",
    scenario: "Health Connect available and permission granted",
    generated_at: nowIso(),
    status: reason ? "not_run" : checks.some((check) => check.status === "failed") ? "fail" : "pass_static",
    platform: "Android",
    metadata: {
      runtime_check_reason: reason || "runtime checks not executed",
      notes: "Static checks validate provider availability/version/install branches, read-only permission matrix, token/read-error handling, and non-blocking startup guard."
    },
    summary: summarize(checks),
    checks
  };
}

function buildErrorEvidence() {
  const checks = [
    {
      name: "provider_unavailable_runtime",
      status: "skipped",
      details: "Provider unavailable/outdated runtime scenario requires Android device matrix testing"
    }
  ];

  return {
    task: "T26",
    scenario: "Health Connect unavailable or outdated",
    generated_at: nowIso(),
    status: "not_run",
    platform: "Android",
    metadata: {
      reason: "Runtime device QA deferred",
      required_followup: "Run unavailable/outdated provider path on Android devices and verify install/update guidance + non-blocking core UX."
    },
    summary: summarize(checks),
    checks
  };
}

function main() {
  ensureEvidenceDir();

  const checks = buildStaticChecks();
  const reason = dryRun ? "dry-run mode" : "runtime Android provider and permission flow pending";

  writeFileSync(happyEvidencePath, JSON.stringify(buildHappyEvidence(checks, reason), null, 2));
  writeFileSync(errorEvidencePath, JSON.stringify(buildErrorEvidence(), null, 2));

  if (checks.some((check) => check.status === "failed")) {
    console.error("T26 health connect provider static checks failed.");
    process.exit(1);
  }

  console.log("T26 health connect provider evidence generated.");
}

main();
