import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const evidenceDir = join(repoRoot, ".sisyphus", "evidence");
const failureDir = join(evidenceDir, "failures", "task-20");

const suiteEvidencePath = join(evidenceDir, "task-20-e2e-suite.json");
const suiteErrorEvidencePath = join(evidenceDir, "task-20-e2e-suite-error.json");

const dryRun = process.argv.includes("--dry-run");

const env = {
  maestroBin: process.env.E2E_MAESTRO_BIN || "maestro",
  runtime: process.env.E2E_RUNTIME === "true",
  platforms: (process.env.E2E_PLATFORMS || "ios,android")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  iosDeviceId: process.env.E2E_IOS_DEVICE_ID,
  androidDeviceId: process.env.E2E_ANDROID_DEVICE_ID,
  healthRequired: process.env.E2E_HEALTH_REQUIRED === "true",
  injectContractBreak: process.env.E2E_INJECT_CONTRACT_BREAK === "true"
};

const coreFlows = [
  ".maestro/task-20-core-auth-onboarding-dashboard.yaml",
  ".maestro/task-20-core-record-upload-history.yaml",
  ".maestro/task-20-core-goals-dashboard.yaml",
  ".maestro/task-20-core-mood-feedback.yaml",
  ".maestro/task-20-core-logout-relogin.yaml"
];

const healthFlows = [
  ".maestro/task-20-health-connect.yaml",
  ".maestro/task-20-health-denied.yaml",
  ".maestro/task-20-health-revoked.yaml",
  ".maestro/task-20-health-stale-fallback.yaml"
];

function nowIso() {
  return new Date().toISOString();
}

function ensureDirs() {
  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(failureDir, { recursive: true });
}

function toFlowId(pathValue) {
  return pathValue
    .replace(/^\.maestro\//, "")
    .replace(/\.ya?ml$/i, "");
}

function toPlatformDevice(platform) {
  if (platform === "ios") {
    return env.iosDeviceId || null;
  }

  if (platform === "android") {
    return env.androidDeviceId || null;
  }

  return null;
}

function writeJson(pathValue, payload) {
  ensureDirs();
  writeFileSync(pathValue, JSON.stringify(payload, null, 2));
}

function summarize(records) {
  const passed = records.filter((record) => record.status === "passed").length;
  const failed = records.filter((record) => record.status === "failed").length;
  const skipped = records.filter((record) => record.status === "skipped").length;
  const fallback = records.filter((record) => record.status === "fallback").length;

  return {
    passed,
    failed,
    skipped,
    fallback,
    total: records.length
  };
}

function makeNotRunEvidence(reason) {
  const baseCheck = {
    name: "suite_execution",
    status: "skipped",
    reason
  };

  const suiteEvidence = {
    scenario: "full_happy_path_suite",
    generated_at: nowIso(),
    status: "not_run",
    metadata: {
      reason,
      expected_flows: coreFlows.length,
      expected_platforms: env.platforms,
      required_artifacts: ["task-20-e2e-suite.json", "task-20-e2e-suite-error.json"]
    },
    summary: {
      passed: 0,
      failed: 0,
      skipped: 1,
      fallback: 0,
      total: 1
    },
    checks: [baseCheck]
  };

  const errorEvidence = {
    scenario: "contract_break_detection",
    generated_at: nowIso(),
    status: "not_run",
    metadata: {
      reason,
      injection_required: true
    },
    summary: {
      passed: 0,
      failed: 0,
      skipped: 1,
      fallback: 0,
      total: 1
    },
    checks: [baseCheck]
  };

  return { suiteEvidence, errorEvidence };
}

async function runCommand(command, args, workdir, timeoutMs = 240000) {
  return await new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: workdir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: typeof code === "number" ? code : 1,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

async function runFlow({ platform, flowPath, type }) {
  const flowId = toFlowId(flowPath);
  const deviceId = toPlatformDevice(platform);

  const args = ["test", flowPath];
  if (deviceId) {
    args.push("--device", deviceId);
  }

  const commandDisplay = `${env.maestroBin} ${args.join(" ")}`;

  const result = await runCommand(env.maestroBin, args, repoRoot);
  const status = result.exitCode === 0 ? "passed" : "failed";

  const artifactPath = join(failureDir, `${platform}-${flowId}.log`);
  const artifactText = [
    `command: ${commandDisplay}`,
    `exitCode: ${result.exitCode}`,
    `timedOut: ${result.timedOut}`,
    "",
    "--- stdout ---",
    result.stdout,
    "",
    "--- stderr ---",
    result.stderr
  ].join("\n");
  writeFileSync(artifactPath, artifactText);

  return {
    id: `${platform}:${flowId}`,
    platform,
    type,
    flow: flowPath,
    command: commandDisplay,
    status,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    artifact_log: artifactPath.replace(`${repoRoot}/`, "")
  };
}

async function runSuite() {
  const checks = [];

  for (const platform of env.platforms) {
    for (const flowPath of coreFlows) {
      checks.push(await runFlow({ platform, flowPath, type: "core" }));
    }

    for (const flowPath of healthFlows) {
      const result = await runFlow({ platform, flowPath, type: "health" });

      if (!env.healthRequired && result.status === "failed") {
        checks.push({
          ...result,
          status: "fallback",
          fallback_reason: "health flow failed under no-go fallback mode"
        });
      } else {
        checks.push(result);
      }
    }
  }

  return checks;
}

async function runFailureInjection() {
  if (!env.injectContractBreak) {
    return {
      scenario: "contract_break_detection",
      generated_at: nowIso(),
      status: "not_run",
      metadata: {
        reason: "Set E2E_INJECT_CONTRACT_BREAK=true to run injected failure scenario."
      },
      summary: {
        passed: 0,
        failed: 0,
        skipped: 1,
        fallback: 0,
        total: 1
      },
      checks: [
        {
          id: "contract-break:not-run",
          status: "skipped",
          reason: "failure injection disabled"
        }
      ]
    };
  }

  const platform = env.platforms[0] || "ios";
  const brokenFlowPath = ".maestro/task-20-contract-break-injected.yaml";
  const check = await runFlow({ platform, flowPath: brokenFlowPath, type: "failure-injection" });

  return {
    scenario: "contract_break_detection",
    generated_at: nowIso(),
    status: check.status === "failed" ? "pass" : "fail",
    metadata: {
      expected_outcome: "flow execution fails with traceable artifact"
    },
    summary: summarize([check]),
    checks: [check]
  };
}

async function main() {
  ensureDirs();

  if (dryRun || !env.runtime) {
    const reason = dryRun
      ? "dry-run mode"
      : "runtime disabled (set E2E_RUNTIME=true for maestro execution)";
    const { suiteEvidence, errorEvidence } = makeNotRunEvidence(reason);
    writeJson(suiteEvidencePath, suiteEvidence);
    writeJson(suiteErrorEvidencePath, errorEvidence);
    console.log("T20 E2E dry/not-run evidence generated.");
    return;
  }

  const checks = await runSuite();
  const summary = summarize(checks);

  const coreFailures = checks.filter((check) => check.type === "core" && check.status === "failed");
  const healthFailures = checks.filter((check) => check.type === "health" && check.status === "failed");
  const fallbackCount = checks.filter((check) => check.status === "fallback").length;

  const status = coreFailures.length > 0 || (env.healthRequired && healthFailures.length > 0)
    ? "fail"
    : fallbackCount > 0
      ? "pass_with_no_go_fallback"
      : "pass";

  const suiteEvidence = {
    scenario: "full_happy_path_suite",
    generated_at: nowIso(),
    status,
    metadata: {
      runtime: true,
      platforms: env.platforms,
      health_required: env.healthRequired,
      expected_core_flows_per_platform: coreFlows.length,
      expected_health_flows_per_platform: healthFlows.length,
      required_artifacts: ["task-20-e2e-suite.json", "task-20-e2e-suite-error.json"]
    },
    summary,
    checks
  };

  writeJson(suiteEvidencePath, suiteEvidence);

  const errorEvidence = await runFailureInjection();
  writeJson(suiteErrorEvidencePath, errorEvidence);

  if (suiteEvidence.status === "fail" || errorEvidence.status === "fail") {
    console.error("T20 E2E suite failed. Check evidence artifacts.");
    process.exit(1);
  }

  console.log("T20 E2E suite completed.");
}

await main();
