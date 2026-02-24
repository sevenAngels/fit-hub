import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const evidenceDir = join(__dirname, "..", ".sisyphus", "evidence");
const happyEvidencePath = join(evidenceDir, "task-19-rls-smoke.json");
const failureEvidencePath = join(evidenceDir, "task-19-rls-smoke-error.json");

const dryRun = process.argv.includes("--dry-run");

const env = {
  supabaseUrl: process.env.T19_SUPABASE_URL || process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.T19_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  tokenA: process.env.T19_USER_A_ACCESS_TOKEN,
  userAId: process.env.T19_USER_A_ID,
  tokenB: process.env.T19_USER_B_ACCESS_TOKEN,
  userBId: process.env.T19_USER_B_ID,
  userBGoalId: process.env.T19_USER_B_GOAL_ID,
  revokedToken: process.env.T19_REVOKED_ACCESS_TOKEN,
  staleToken: process.env.T19_STALE_ACCESS_TOKEN || "invalid.token.payload",
  table: process.env.T19_REST_TABLE || "goals",
  bucket: process.env.T19_STORAGE_BUCKET || "meal-images",
  storagePrefix: process.env.T19_STORAGE_PREFIX || "rls-smoke",
  storageFolder: process.env.T19_STORAGE_FOLDER || "rls",
};

const requiredVars = ["supabaseUrl", "anonKey", "tokenA"];

const denyStatuses = new Set([401, 403]);
const ambiguousDenyStatuses = new Set([400, 404]);

function nowIso() {
  return new Date().toISOString();
}

function toYmd(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function randomRunId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;
}

function ensureEvidenceDir() {
  mkdirSync(evidenceDir, { recursive: true });
}

function writeEvidence(filePath, payload) {
  ensureEvidenceDir();
  writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function summarizeChecks(checks) {
  const passed = checks.filter((check) => check.status === "passed").length;
  const failed = checks.filter((check) => check.status === "failed").length;
  const skipped = checks.filter((check) => check.status === "skipped").length;
  return { passed, failed, skipped, total: checks.length };
}

function finalizeScenario(name, checks, metadata = {}) {
  const summary = summarizeChecks(checks);
  const status = summary.failed > 0 ? "fail" : summary.skipped === checks.length ? "not_run" : "pass";
  return {
    scenario: name,
    generated_at: nowIso(),
    status,
    summary,
    metadata,
    checks,
  };
}

function makeNotRunEvidence(reason) {
  const checks = [{ name: "execution", status: "skipped", details: reason, expected: "runtime checks skipped", actual: "skipped" }];
  return {
    happy: finalizeScenario("authorized_crud_and_upload", checks),
    failure: finalizeScenario("cross_user_denial_and_stale_token", checks),
  };
}

function encodeObjectPath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sanitizeHeaders(headers = {}) {
  const safeHeaders = { ...headers };
  if (safeHeaders.Authorization) {
    safeHeaders.Authorization = safeHeaders.Authorization.replace(/Bearer\s+.*/, "Bearer [redacted]");
  }
  return safeHeaders;
}

function authHeaders(token, anonKey, contentType) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return headers;
}

function asArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    url,
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    data,
    rawText: text,
  };
}

async function requestBinary(url, options) {
  const response = await fetch(url, options);
  const bytes = await response.arrayBuffer();
  return {
    url,
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
    size: bytes.byteLength,
    raw: Buffer.from(bytes),
  };
}

function buildRestPath(base, resource, query = {}) {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${resource}`;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function resolveUserIdFromToken(token) {
  const response = await requestJson(`${env.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: authHeaders(token, env.anonKey),
  });

  const userId = response?.data?.id;
  if (!response.ok || !userId) {
    return {
      userId: null,
      response,
    };
  }

  return {
    userId,
    response,
  };
}

function statusPass(status, expected) {
  return expected.includes(status);
}

function isDenied(status) {
  return denyStatuses.has(status) || ambiguousDenyStatuses.has(status);
}

function addCheck(checks, name, status, details) {
  checks.push({
    name,
    status,
    details,
  });
}

async function createGoalRow(restBase, token, userId, runId, prefix) {
  const payload = {
    goal_type: "habit",
    title: `${prefix}-${runId}`,
    status: "active",
    start_date: nowIso(),
  };

  if (userId) {
    payload.user_id = userId;
  }

  const response = await requestJson(buildRestPath(restBase, "goals"), {
    method: "POST",
    headers: {
      ...authHeaders(token, env.anonKey, "application/json"),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const rows = asArrayPayload(response.data);
  const created = rows[0] ?? null;

  return { response, created };
}

async function readGoalById(restBase, token, goalId, userId, userScoped = true) {
  const filters = [
    ["id", `eq.${goalId}`],
    ["select", "id,user_id,title,status,start_date"],
  ];

  if (userScoped && userId) {
    filters.push(["user_id", `eq.${userId}`]);
  }

  const query = new URLSearchParams();
  for (const [key, value] of filters) {
    query.set(key, value);
  }

  const response = await requestJson(`${env.supabaseUrl}/rest/v1/goals?${query.toString()}`, {
    method: "GET",
    headers: authHeaders(token, env.anonKey),
  });

  return { response, rows: asArrayPayload(response.data) };
}

function getStatusAndRows(result) {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === "object" && Array.isArray(result.rows)) return result.rows.length;
  if (result && typeof result === "object" && result.data && Array.isArray(result.data)) return result.data.length;
  return 0;
}

async function updateGoal(restBase, token, goalId, payload) {
  const response = await requestJson(buildRestPath(restBase, "goals", { id: `eq.${encodeURIComponent(goalId)}` }), {
    method: "PATCH",
    headers: {
      ...authHeaders(token, env.anonKey, "application/json"),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const rows = asArrayPayload(response.data);
  return { response, rows };
}

async function deleteGoal(restBase, token, goalId, userId) {
  const qs = new URLSearchParams({
    id: `eq.${goalId}`,
  });

  if (userId) {
    qs.set("user_id", `eq.${userId}`);
  }

  const response = await requestJson(`${restBase}/goals?${qs.toString()}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(token, env.anonKey),
      Prefer: "return=minimal",
    },
  });

  return response;
}

async function uploadStorage(storageBase, bucket, token, objectPath, fileBuffer) {
  return requestJson(`${storageBase}/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`, {
    method: "POST",
    headers: {
      ...authHeaders(token, env.anonKey, "image/png"),
      "x-upsert": "false",
    },
    body: fileBuffer,
  });
}

async function listStorage(storageBase, bucket, token, prefix, runId = randomRunId()) {
  const requestBody = {
    prefix,
    limit: 100,
    offset: 0,
    sortBy: {
      column: "name",
      order: "asc",
    },
    search: `runId:${runId}`,
  };

  return requestJson(`${storageBase}/${encodeURIComponent(bucket)}/list`, {
    method: "POST",
    headers: {
      ...authHeaders(token, env.anonKey, "application/json"),
    },
    body: JSON.stringify(requestBody),
  });
}

async function downloadStorage(storageBase, bucket, token, objectPath) {
  return requestBinary(`${storageBase}/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`, {
    method: "GET",
    headers: authHeaders(token, env.anonKey),
  });
}

async function deleteStorage(storageBase, bucket, token, objectPath) {
  return requestJson(`${storageBase}/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`, {
    method: "DELETE",
    headers: authHeaders(token, env.anonKey),
  });
}

function makeStoragePath(base, userId, runId, suffix) {
  return `${userId}/${base}/${suffix}-${runId}.png`;
}

async function runHappyScenario() {
  const checks = [];
  const created = {
    goals: [],
    objects: [],
  };

  const runId = randomRunId();
  const restBase = `${env.supabaseUrl}/rest/v1`;
  const storageBase = `${env.supabaseUrl}/storage/v1/object`;
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YxR7vQAAAAASUVORK5CYII=",
    "base64"
  );

  let userAId = env.userAId;
  if (!userAId) {
    const resolvedA = await resolveUserIdFromToken(env.tokenA);
    if (resolvedA.userId) {
      userAId = resolvedA.userId;
      checks.push({
        name: "resolve_user_a_id",
        status: "passed",
        details: `status=${resolvedA.response.status}`,
      });
    } else {
      checks.push({
        name: "resolve_user_a_id",
        status: "failed",
        details: `status=${resolvedA.response.status}, message=${resolvedA.response.statusText}`,
      });
      return finalizeScenario("authorized_crud_and_upload", checks, { table: env.table, bucket: env.bucket, userAId: null, runId });
    }
  } else {
    checks.push({
      name: "resolve_user_a_id",
      status: "passed",
      details: "user_a_id provided via T19_USER_A_ID",
    });
  }

  const ownGoalTitle = `${env.storagePrefix}-goal-${runId}`;
  const ownPath = makeStoragePath(env.storageFolder, userAId, runId, "own");

  const createGoal = await createGoalRow(restBase, env.tokenA, userAId, runId, ownGoalTitle);
  const ownGoal = createGoal.created ?? null;
  const createdGoal = ownGoal ?? null;

  addCheck(checks, "own_crud_create", createGoal.response.ok && !!createdGoal ? "passed" : "failed", `status=${createGoal.response.status}`);

  if (createdGoal?.id) {
    created.goals.push({ id: createdGoal.id, token: env.tokenA, userId: userAId });

    const readResult = await readGoalById(restBase, env.tokenA, createdGoal.id, userAId, true);
    const readRows = readResult.rows;
    addCheck(
      checks,
      "own_crud_read",
      readResult.response.ok && readRows.length === 1 ? "passed" : "failed",
      `status=${readResult.response.status}, rows=${readRows.length}`
    );

    const updateResult = await updateGoal(restBase, env.tokenA, createdGoal.id, { title: `${ownGoalTitle}-updated` });
    addCheck(
      checks,
      "own_crud_update",
      updateResult.response.ok && asArrayPayload(updateResult.rows).length === 1 ? "passed" : "failed",
      `status=${updateResult.response.status}, rows=${asArrayPayload(updateResult.rows).length}`
    );

    const deleteResult = await deleteGoal(restBase, env.tokenA, createdGoal.id, userAId);
    const deletePassed = [200, 204, 205, 404].includes(deleteResult.status);
    addCheck(checks, "own_crud_delete", deletePassed ? "passed" : "failed", `status=${deleteResult.status}`);
  }

  const uploadResult = await uploadStorage(storageBase, env.bucket, env.tokenA, ownPath, tinyPng);
  addCheck(checks, "own_storage_upload", uploadResult.ok ? "passed" : "failed", `status=${uploadResult.status}`);

  if (uploadResult.ok) {
    created.objects.push({ path: ownPath, bucket: env.bucket, token: env.tokenA });

    const ownListResult = await listStorage(storageBase, env.bucket, env.tokenA, `${userAId}/${env.storageFolder}`);
    addCheck(checks, "own_storage_list", ownListResult.ok ? "passed" : "failed", `status=${ownListResult.status}`);

    const downloadResult = await downloadStorage(storageBase, env.bucket, env.tokenA, ownPath);
    addCheck(
      checks,
      "own_storage_download",
      downloadResult.ok && downloadResult.size > 0,
      `status=${downloadResult.status}, bytes=${downloadResult.size}`
    );

    const deleteObjectResult = await deleteStorage(storageBase, env.bucket, env.tokenA, ownPath);
    const ownDeletePassed = [200, 204].includes(deleteObjectResult.status);
    addCheck(checks, "own_storage_delete", ownDeletePassed ? "passed" : "failed", `status=${deleteObjectResult.status}`);
    if (ownDeletePassed) {
      created.objects = created.objects.filter((entry) => entry.path !== ownPath);
    }
  }

  return {
    result: finalizeScenario("authorized_crud_and_upload", checks, {
      table: env.table,
      bucket: env.bucket,
      own_object: ownPath,
      runId,
      run_user_id: userAId,
    }),
    created,
    runId,
  };
}

async function runFailureScenario(knownContext) {
  const checks = [];
  const created = {
    goals: [],
    objects: [],
  };
  const runId = randomRunId();
  const storageBase = `${env.supabaseUrl}/storage/v1/object`;
  const restBase = `${env.supabaseUrl}/rest/v1`;
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YxR7vQAAAAASUVORK5CYII=",
    "base64"
  );

  let userBId = env.userBId;
  let tokenB = env.tokenB;

  if (tokenB) {
    const resolvedB = await resolveUserIdFromToken(tokenB);
    if (resolvedB.userId) {
      userBId = resolvedB.userId;
      addCheck(checks, "resolve_user_b_id", "passed", `status=${resolvedB.response.status}`);
    } else {
      addCheck(checks, "resolve_user_b_id", "failed", `status=${resolvedB.response.status}`);
      userBId = null;
    }
  } else {
    addCheck(checks, "resolve_user_b_id", "skipped", "T19_USER_B_ACCESS_TOKEN missing");
  }

  let crossGoalId = env.userBGoalId;
  if (crossGoalId && tokenB && userBId) {
    addCheck(checks, "cross_user_goal_seed", "skipped", "token-provided but userBGoalId already set");
  }

  if (!crossGoalId && tokenB && userBId) {
    const seeded = await createGoalRow(restBase, tokenB, userBId, runId, `${env.storagePrefix}-cross`);
    const crossCreated = seeded.created ?? null;
    if (crossCreated?.id) {
      crossGoalId = crossCreated.id;
      created.goals.push({ id: crossCreated.id, token: tokenB, userId: userBId });
      addCheck(checks, "cross_user_goal_seed", "passed", `status=${seeded.response.status}, id=${crossCreated.id}`);
    } else {
      addCheck(checks, "cross_user_goal_seed", "failed", `status=${seeded.response.status}`);
    }
  } else if (!tokenB) {
    addCheck(checks, "cross_user_goal_seed", "skipped", "T19_USER_B_ACCESS_TOKEN missing");
  }

  const hasCrossGoal = !!crossGoalId;
  if (hasCrossGoal && env.tokenB && tokenB) {
    const crossRead = await readGoalById(restBase, env.tokenA, crossGoalId, userBId, true);
    const crossRows = crossRead.rows;
    const denied = isDenied(crossRead.response.status) || crossRows.length === 0;
    addCheck(
      checks,
      "cross_user_read_denied",
      denied ? "passed" : "failed",
      `status=${crossRead.response.status}, rows=${crossRows.length}`
    );

    const crossUpdate = await updateGoal(restBase, env.tokenA, crossGoalId, {
      title: `cross-update-${runId}`,
    });
    const crossUpdateRows = asArrayPayload(crossUpdate.rows);
    const crossUpdateDenied = isDenied(crossUpdate.response.status) || crossUpdateRows.length === 0;
    addCheck(
      checks,
      "cross_user_update_denied",
      crossUpdateDenied ? "passed" : "failed",
      `status=${crossUpdate.response.status}, rows=${crossUpdateRows.length}`
    );
  } else {
    addCheck(checks, "cross_user_read_denied", "skipped", hasCrossGoal ? "missing auth for user B" : "no cross target goal");
    addCheck(checks, "cross_user_update_denied", "skipped", hasCrossGoal ? "missing auth for user B" : "no cross target goal");
  }

  const crossObjectPrefix = userBId || "cross-user";
  const crossStoragePath = makeStoragePath(env.storageFolder, crossObjectPrefix, runId, "cross");

  if (tokenB && userBId) {
    const seededUpload = await uploadStorage(storageBase, env.bucket, tokenB, crossStoragePath, tinyPng);
    if (seededUpload.ok) {
      created.objects.push({ path: crossStoragePath, bucket: env.bucket, token: tokenB });
      addCheck(checks, "cross_user_storage_seed", "passed", `status=${seededUpload.status}`);
    } else {
      addCheck(checks, "cross_user_storage_seed", "failed", `status=${seededUpload.status}`);
    }

    const crossDownload = await downloadStorage(storageBase, env.bucket, env.tokenA, crossStoragePath);
    const crossDownloadDenied = isDenied(crossDownload.status) || crossDownload.status === 404 || crossDownload.status === 400;
    addCheck(
      checks,
      "cross_user_storage_download_denied",
      crossDownloadDenied ? "passed" : "failed",
      `status=${crossDownload.status}, bytes=${crossDownload.size ?? 0}`
    );

    const crossDelete = await deleteStorage(storageBase, env.bucket, env.tokenA, crossStoragePath);
    const crossDeleteDenied = isDenied(crossDelete.status) || crossDelete.status === 404;
    addCheck(
      checks,
      "cross_user_storage_delete_denied",
      crossDeleteDenied ? "passed" : "failed",
      `status=${crossDelete.status}`
    );
  } else {
    const crossUpload = await uploadStorage(storageBase, env.bucket, env.tokenA, crossStoragePath, tinyPng);
    const crossUploadDenied = isDenied(crossUpload.status) || crossUpload.status === 400;
    addCheck(
      checks,
      "cross_user_storage_upload_denied",
      crossUploadDenied ? "passed" : "failed",
      `status=${crossUpload.status}`
    );
  }

  const staleTokenResult = await requestJson(`${env.supabaseUrl}/rest/v1/${env.table}?select=id&limit=1`, {
    method: "GET",
    headers: authHeaders(env.staleToken, env.anonKey),
  });
  addCheck(
    checks,
    "stale_token_denied",
    statusPass(staleTokenResult.status, [400, 401, 403]) ? "passed" : "failed",
    `status=${staleTokenResult.status}`
  );

  if (env.revokedToken) {
    const revokedResult = await requestJson(`${env.supabaseUrl}/rest/v1/${env.table}?select=id&limit=1`, {
      method: "GET",
      headers: authHeaders(env.revokedToken, env.anonKey),
    });

    addCheck(
      checks,
      "revoked_token_denied",
      statusPass(revokedResult.status, [401, 403, 400]) ? "passed" : "failed",
      `status=${revokedResult.status}`
    );
  } else {
    addCheck(checks, "revoked_token_denied", "skipped", "T19_REVOKED_ACCESS_TOKEN missing");
  }

  return {
    result: finalizeScenario("cross_user_denial_and_stale_token", checks, {
      table: env.table,
      bucket: env.bucket,
      runId,
      cross_user_goal_id: crossGoalId,
      cross_user_bucket_path: crossStoragePath,
    }),
    created,
  };
}

async function cleanup(resources, label) {
  const cleanupErrors = [];

  for (const goal of resources.goals) {
    try {
      await deleteGoal(`${env.supabaseUrl}/rest/v1`, goal.token, goal.id, goal.userId);
    } catch (error) {
      cleanupErrors.push({ type: "goal", id: goal.id, message: String(error) });
    }
  }

  for (const object of resources.objects) {
    try {
      await deleteStorage(`${env.supabaseUrl}/storage/v1/object`, object.bucket, object.token, object.path);
    } catch (error) {
      cleanupErrors.push({ type: "storage", path: object.path, message: String(error) });
    }
  }

  if (cleanupErrors.length > 0) {
    console.error(`[${label}] Cleanup encountered ${cleanupErrors.length} issue(s).`);
  }
}

async function main() {
  if (dryRun) {
    const evidence = makeNotRunEvidence("dry-run mode");
    writeEvidence(happyEvidencePath, evidence.happy);
    writeEvidence(failureEvidencePath, evidence.failure);
    console.log("T19 smoke dry-run evidence generated.");
    return;
  }

  const missing = requiredVars.filter((key) => !env[key]);
  if (missing.length > 0) {
    const evidence = makeNotRunEvidence(`missing env: ${missing.join(", ")}`);
    writeEvidence(happyEvidencePath, evidence.happy);
    writeEvidence(failureEvidencePath, evidence.failure);
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  let happy;
  let failure;

  try {
    const happyRun = await runHappyScenario();
    happy = happyRun.result;
    await cleanup(happyRun.created, "happy");

    const failureRun = await runFailureScenario(happyRun);
    failure = failureRun.result;
    await cleanup(failureRun.created, "failure");
  } catch (error) {
    const fallback = {
      scenario: "execution_error",
      generated_at: nowIso(),
      status: "fail",
      summary: {
        passed: 0,
        failed: 1,
        skipped: 0,
        total: 1,
      },
      metadata: { error: String(error?.message || error) },
      checks: [
        {
          name: "script_execution",
          status: "failed",
          details: String(error),
        },
      ],
    };

    writeEvidence(happyEvidencePath, fallback);
    writeEvidence(failureEvidencePath, fallback);
    console.error(`Unexpected error while running T19 smoke checks: ${String(error?.message || error)}`);
    process.exit(1);
  }

  writeEvidence(happyEvidencePath, happy);
  writeEvidence(failureEvidencePath, failure);

  const hasFailures = happy.summary.failed > 0 || failure.summary.failed > 0;
  if (hasFailures) {
    console.error("T19 smoke checks failed. See evidence JSON files.");
    process.exit(1);
  }

  console.log("T19 smoke checks passed.");
}

await main();
