import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const evidenceDir = join(repoRoot, ".sisyphus", "evidence");

const happyEvidencePath = join(evidenceDir, "task-23-release-beta.json");
const failureEvidencePath = join(evidenceDir, "task-23-release-beta-error.json");

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
    checkContains("apps/mobile/eas.json", '"preview"', "eas_preview_profile_exists"),
    checkContains("apps/mobile/eas.json", '"production"', "eas_production_profile_exists"),
    checkContains("docs/mobile-release-runbook.md", "Rollback trigger conditions", "rollback_triggers_documented"),
    checkContains("docs/mobile-release-runbook.md", "health:enabled = false", "health_fallback_documented"),
    checkContains("docs/mobile-go-no-go-checklist.md", "P0/P1", "go_no_go_severity_gate_documented"),
    checkContains(".github/workflows/mobile-ci.yml", "Release beta contract dry-run", "ci_release_gate_step_exists")
  ];
}

function buildHappyEvidence(checks, reason) {
  return {
    scenario: "beta_release_readiness",
    generated_at: nowIso(),
    status: reason ? "not_run" : checks.some((check) => check.status === "failed") ? "fail" : "pass_static",
    metadata: {
      runtime_check_reason: reason || "runtime checks not executed",
      notes: "Static checks verify EAS profile, runbook, rollback, and go/no-go package wiring."
    },
    summary: summarize(checks),
    checks
  };
}

function buildFailureEvidence(reason) {
  const checks = [
    {
      name: "rollback_rehearsal_runtime",
      status: "skipped",
      details: reason
    }
  ];

  return {
    scenario: "rollback_rehearsal",
    generated_at: nowIso(),
    status: "not_run",
    metadata: {
      reason,
      required_followup: "Execute rollback drill in internal beta channel and document recovery time."
    },
    summary: summarize(checks),
    checks
  };
}

function main() {
  const checks = buildStaticChecks();

  const happyReason = dryRun
    ? "dry-run mode"
    : "internal beta submission requires credentials and store console access";

  const happyEvidence = buildHappyEvidence(checks, happyReason);
  const failureEvidence = buildFailureEvidence("Rollback rehearsal deferred to credentialed beta environment");

  writeJson(happyEvidencePath, happyEvidence);
  writeJson(failureEvidencePath, failureEvidence);

  if (checks.some((check) => check.status === "failed")) {
    console.error("T23 release beta static checks failed.");
    process.exit(1);
  }

  console.log("T23 release beta evidence generated.");
}

main();
