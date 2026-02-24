import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const evidenceDir = join(repoRoot, ".sisyphus", "evidence");

const happyEvidencePath = join(evidenceDir, "task-22-subscription-fallback.json");
const failureEvidencePath = join(evidenceDir, "task-22-subscription-fallback-error.json");

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
      "apps/mobile/src/features/subscription/service.ts",
      "getSubscriptionStatus",
      "subscription_service_exists"
    ),
    checkContains(
      "apps/mobile/src/features/subscription/service.ts",
      "/settings/billing",
      "web_checkout_path_configured"
    ),
    checkContains(
      "apps/mobile/app/(protected)/subscription.tsx",
      "useSubscriptionStatus",
      "subscription_screen_status_display"
    ),
    checkContains(
      "apps/mobile/app/(protected)/subscription.tsx",
      "openWebCheckout",
      "subscription_screen_checkout_fallback"
    ),
    checkContains(
      "apps/mobile/app/(protected)/index.tsx",
      "/(protected)/subscription",
      "dashboard_navigation_to_subscription"
    )
  ];
}

function buildHappyEvidence(checks, reason) {
  return {
    scenario: "status_display_and_fallback_navigation",
    generated_at: nowIso(),
    status: reason ? "not_run" : checks.some((check) => check.status === "failed") ? "fail" : "pass_static",
    metadata: {
      runtime_check_reason: reason || "runtime checks not executed",
      notes: "Static checks confirm subscription status and web checkout fallback wiring. Runtime billing flow verification remains pending."
    },
    summary: summarize(checks),
    checks
  };
}

function buildFailureEvidence(reason) {
  const checks = [
    {
      name: "checkout_cancel_return_runtime",
      status: "skipped",
      details: reason
    }
  ];

  return {
    scenario: "checkout_return_path_failure",
    generated_at: nowIso(),
    status: "not_run",
    metadata: {
      reason,
      required_followup: "Run device scenario with canceled web checkout and verify retry CTA plus stable state."
    },
    summary: summarize(checks),
    checks
  };
}

function main() {
  const checks = buildStaticChecks();

  const happyReason = dryRun
    ? "dry-run mode"
    : "runtime billing and return-path validation requires staging/device flow";

  const happyEvidence = buildHappyEvidence(checks, happyReason);
  const failureEvidence = buildFailureEvidence("Canceled checkout return scenario deferred to runtime validation");

  writeJson(happyEvidencePath, happyEvidence);
  writeJson(failureEvidencePath, failureEvidence);

  if (checks.some((check) => check.status === "failed")) {
    console.error("T22 subscription fallback static checks failed.");
    process.exit(1);
  }

  console.log("T22 subscription fallback evidence generated.");
}

main();
