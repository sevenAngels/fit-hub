import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultGateEvidence = join(__dirname, "..", ".sisyphus", "evidence", "task-30-health-go-no-go.json");

function resolveEvidencePath() {
  const args = process.argv.slice(2);
  const evidenceFlagIndex = args.indexOf("--evidence");
  if (evidenceFlagIndex === -1) {
    return defaultGateEvidence;
  }

  const flagValue = args[evidenceFlagIndex + 1];
  if (!flagValue || flagValue.startsWith("--")) {
    return defaultGateEvidence;
  }

  if (flagValue.startsWith("/")) {
    return flagValue;
  }

  return join(__dirname, "..", flagValue);
}

const gateEvidence = resolveEvidencePath();

function coerceNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const sanitized = value.replace(/,/g, "").replace(/%/g, "");
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : Number.isFinite(Number.parseFloat(sanitized)) ? Number.parseFloat(sanitized) : undefined;
  }
  return undefined;
}

function parseOperator(raw) {
  const [, operator, rhs] = String(raw ?? "").match(/^(<=|>=|<|>|=)\s*(.+)$/) || [];
  return operator ? { operator, target: rhs.trim() } : null;
}

function evaluateComparison(actual, comparator) {
  const comparison = parseOperator(comparator);
  if (!comparison) {
    return { passed: false, reason: `Invalid comparator '${comparator}'` };
  }

  const target = coerceNumber(comparison.target);
  if (target === undefined || actual === undefined) {
    return { passed: false, reason: "Missing numeric metric" };
  }

  switch (comparison.operator) {
    case ">=":
      return {
        passed: actual >= target,
        reason: actual >= target ? "ok" : `Observed ${actual} < ${target}`,
      };
    case "<=":
      return {
        passed: actual <= target,
        reason: actual <= target ? "ok" : `Observed ${actual} > ${target}`,
      };
    case ">":
      return {
        passed: actual > target,
        reason: actual > target ? "ok" : `Observed ${actual} <= ${target}`,
      };
    case "<":
      return {
        passed: actual < target,
        reason: actual < target ? "ok" : `Observed ${actual} >= ${target}`,
      };
    case "=":
      return {
        passed: actual === target,
        reason: actual === target ? "ok" : `Observed ${actual} != ${target}`,
      };
    default:
      return { passed: false, reason: `Unsupported operator ${comparison.operator}` };
  }
}

function evaluateGateResult(gates, measurement, threshold) {
  if (!Object.prototype.hasOwnProperty.call(gates, measurement)) {
    return {
      passed: false,
      reason: `${measurement} missing from measurement payload`,
    };
  }

  const rawMetric = gates[measurement];
  if (rawMetric?.status && String(rawMetric.status).toLowerCase() === "not_run") {
    return { passed: false, reason: `${measurement} not collected (status: ${rawMetric.status})` };
  }

  if (typeof rawMetric?.value === "undefined") {
    return { passed: false, reason: `${measurement} has no value` };
  }

  const actual = coerceNumber(rawMetric.value);
  const result = evaluateComparison(actual, threshold);
  return {
    passed: result.passed,
    reason: result.reason,
    value: rawMetric.value,
  };
}

function isFallbackRecorded(logEntry) {
  if (!logEntry || typeof logEntry !== "object") return false;
  const decision = String(logEntry.decision || "").trim().toLowerCase();
  return !!(logEntry.owner && decision && decision !== "pending");
}

if (!existsSync(gateEvidence)) {
  console.log("HEALTH_GATES=NO_GO");
  console.log("reason=evidence_file_missing");
  console.log("fallback=feature_flags_off");
  process.exit(0);
}

const raw = readFileSync(gateEvidence, "utf8");
const evidence = JSON.parse(raw);

const checks = [];

for (const [name, threshold] of Object.entries(evidence.thresholds || {})) {
  const result = evaluateGateResult(evidence.measurements || {}, name, threshold);
  checks.push({
    name,
    passed: result.passed,
    value: result.value,
    comparator: threshold,
    reason: result.reason,
  });
}

const ownerLog = Array.isArray(evidence.owner_log) ? evidence.owner_log : [];
const hasOwnerDecision = ownerLog.some(isFallbackRecorded);

if (!hasOwnerDecision) {
  checks.push({
    name: "owner_decision_log",
    passed: false,
    reason: "No owner sign-off record present yet",
  });
}

if (evidence.rollback_test) {
  const rollbackStatus = String(evidence.rollback_test.result || "not_run").toLowerCase();
  if (rollbackStatus !== "pass" && rollbackStatus !== "passed") {
    checks.push({
      name: "rollback_test",
      passed: false,
      reason: `rollback_test result is '${evidence.rollback_test.result || "not_run"}'`,
    });
  } else {
    const elapsed = coerceNumber(evidence.rollback_test.elapsed_minutes);
    const target = coerceNumber(evidence.rollback_test.target_time_minutes);
    if (elapsed === undefined || target === undefined) {
      checks.push({
        name: "rollback_elapsed",
        passed: false,
        reason: "rollback elapsed_minutes or target_time_minutes missing",
      });
    } else if (elapsed > target) {
      checks.push({
        name: "rollback_elapsed",
        passed: false,
        reason: `rollback elapsed ${elapsed} minutes exceeds target ${target}`,
      });
    }
  }
}

const failures = checks.filter((check) => !check.passed);

if (failures.length === 0) {
  console.log("HEALTH_GATES=PASS");
  console.log("fallback=none");
  process.exit(0);
}

console.log("HEALTH_GATES=NO_GO");
console.log("fallback=feature_flags_off");
console.log("failure_count=" + failures.length);
for (const failure of failures) {
  console.log(`${failure.name}: ${failure.reason}`);
}
