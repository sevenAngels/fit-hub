import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const contractPath = join(repoRoot, ".sisyphus", "evidence", "task-24-health-contract.md");
const happyEvidencePath = join(repoRoot, ".sisyphus", "evidence", "task-24-health-contract.txt");
const failureEvidencePath = join(repoRoot, ".sisyphus", "evidence", "task-24-health-contract-error.txt");

function nowIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function ensureEvidenceDir() {
  mkdirSync(join(repoRoot, ".sisyphus", "evidence"), { recursive: true });
}

function includesAll(content, terms) {
  return terms.map((term) => ({
    term,
    present: content.includes(term)
  }));
}

function evaluateRequiredFieldCheck(content, fields) {
  const result = includesAll(content, fields);
  return {
    result,
    failed: result.some((item) => !item.present)
  };
}

function writeHappyEvidence(content) {
  const dailyFields = [
    "`user_id`",
    "`platform`",
    "`local_date`",
    "`steps`",
    "`active_kcal`",
    "`source`",
    "`data_point_count`",
    "`tz_offset_min`",
    "`synced_at`",
    "`first_seen_at`",
    "`last_seen_at`"
  ];

  const syncFields = [
    "`user_id`",
    "`platform`",
    "`record_type`",
    "`anchor_or_token`",
    "`cursor_state`",
    "`last_success_at`",
    "`last_error_at`",
    "`error_message`",
    "`cursor_version`",
    "`is_running`"
  ];

  const dailyCheck = evaluateRequiredFieldCheck(content, dailyFields);
  const syncCheck = evaluateRequiredFieldCheck(content, syncFields);

  const uniquenessChecks = includesAll(content, [
    "(user_id, platform, local_date, source)",
    "unique"
  ]);

  const retentionChecks = includesAll(content, ["retention", "deletion"]);

  const flagChecks = includesAll(content, [
    "`health:enabled`",
    "`health:ios`",
    "`health:android`"
  ]);

  const backfillChecks = includesAll(content, [
    "30-day",
    "cursor",
    "incremental"
  ]);

  const strategyChecks = includesAll(content, [
    "HKAnchoredObjectQuery",
    "getChanges"
  ]);

  const guardrailChecks = includesAll(content, [
    "read-only",
    "aggregate-only",
    "No write-back",
    "Samsung",
    "Health Connect"
  ]);

  const lines = [];
  lines.push("Task 24 QA Evidence Log");
  lines.push(`Run date: ${nowIsoDate()}`);
  lines.push("");
  lines.push("Check 1: Required health_daily_metrics fields present");
  for (const check of dailyCheck.result) {
    lines.push(`- ${check.term.replaceAll("`", "")}: ${check.present ? "PASS" : "FAIL"}`);
  }
  lines.push("");
  lines.push("Check 2: Required health_daily_metrics uniqueness and retention/deletion");
  for (const check of [...uniquenessChecks, ...retentionChecks]) {
    lines.push(`- ${check.term}: ${check.present ? "PASS" : "FAIL"}`);
  }
  lines.push("");
  lines.push("Check 3: Required health_sync_state fields present");
  for (const check of syncCheck.result) {
    lines.push(`- ${check.term.replaceAll("`", "")}: ${check.present ? "PASS" : "FAIL"}`);
  }
  lines.push("");
  lines.push("Check 4: Feature flags and backfill strategy");
  for (const check of [...flagChecks, ...backfillChecks, ...strategyChecks]) {
    lines.push(`- ${check.term}: ${check.present ? "PASS" : "FAIL"}`);
  }
  lines.push("");
  lines.push("Check 5: Scope guardrails");
  for (const check of guardrailChecks) {
    lines.push(`- ${check.term}: ${check.present ? "PASS" : "FAIL"}`);
  }

  writeFileSync(happyEvidencePath, `${lines.join("\n")}\n`, "utf8");

  const hasFailures = [
    ...dailyCheck.result,
    ...syncCheck.result,
    ...uniquenessChecks,
    ...retentionChecks,
    ...flagChecks,
    ...backfillChecks,
    ...strategyChecks,
    ...guardrailChecks
  ].some((item) => !item.present);

  return { hasFailures };
}

function writeFailureEvidence(content) {
  const forbiddenPatterns = [
    "write-back enabled",
    "persist raw samples",
    "raw event samples required"
  ];

  const forbiddenMatches = forbiddenPatterns.map((pattern) => ({
    pattern,
    found: content.toLowerCase().includes(pattern)
  }));

  const requiredGuardrails = includesAll(content, [
    "No write-back",
    "aggregate-only",
    "non-blocking"
  ]);

  const lines = [];
  lines.push("Task 24 Scope Creep and Failure Checks");
  lines.push(`Run date: ${nowIsoDate()}`);
  lines.push("");
  lines.push("Failure Gate A: explicit write-back/raw-sample requirements");
  for (const match of forbiddenMatches) {
    lines.push(`- ${match.pattern}: ${match.found ? "FAIL" : "PASS"}`);
  }
  lines.push("");
  lines.push("Failure Gate B: guardrails stay explicit");
  for (const check of requiredGuardrails) {
    lines.push(`- ${check.term}: ${check.present ? "PASS" : "FAIL"}`);
  }

  writeFileSync(failureEvidencePath, `${lines.join("\n")}\n`, "utf8");

  const hasForbidden = forbiddenMatches.some((item) => item.found);
  const missingGuardrail = requiredGuardrails.some((item) => !item.present);
  return { hasFailures: hasForbidden || missingGuardrail };
}

function main() {
  if (!existsSync(contractPath)) {
    console.error("T24 contract file not found.");
    process.exit(1);
  }

  ensureEvidenceDir();
  const content = readFileSync(contractPath, "utf8");

  const happy = writeHappyEvidence(content);
  const failure = writeFailureEvidence(content);

  if (happy.hasFailures || failure.hasFailures) {
    console.error("T24 health contract checks failed.");
    process.exit(1);
  }

  console.log("T24 health contract evidence generated.");
}

main();
