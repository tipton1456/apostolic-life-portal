import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.local");

function loadEnv() {
  const env = {};

  try {
    const contents = readFileSync(envPath, "utf8");

    for (const line of contents.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");

      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }
  } catch (error) {
    throw new Error(`Unable to read ${envPath}: ${error.message}`);
  }

  return env;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysAgo(count) {
  const date = startOfToday();
  date.setDate(date.getDate() - count);
  return date.toISOString().slice(0, 10);
}

function daysFromNow(count) {
  const date = startOfToday();
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
}

function calculateStats(tasks) {
  const today = startOfToday();
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const outstandingTasks = totalTasks - completedTasks;
  const overdueTasks = tasks.filter((task) => {
    if (task.status === "completed" || !task.due_date) return false;

    const due = new Date(`${task.due_date}T12:00:00`);
    return due < today;
  }).length;
  const completionPercent =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return {
    totalTasks,
    completedTasks,
    outstandingTasks,
    overdueTasks,
    completionPercent,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function testHttpRoutes(baseUrl) {
  const results = [];

  async function checkRoute(path, expectations) {
    const response = await fetchWithTimeout(`${baseUrl}${path}`, { redirect: "manual" });
    const location = response.headers.get("location") ?? "";
    const body = await response.text();

    for (const expectation of expectations) {
      expectation({ response, location, body, path });
    }

    results.push({ path, status: response.status, location });
  }

  await checkRoute("/projects", [
    ({ response, location }) => {
      assert(
        response.status === 307 || response.status === 302,
        `/projects should redirect unauthenticated users (got ${response.status})`,
      );
      assert(
        location.includes("/login"),
        `/projects should redirect to login (got ${location})`,
      );
    },
  ]);

  await checkRoute("/api/demo-login", [
    async ({ response }) => {
      assert(response.status === 405 || response.status === 404, "demo-login GET should not expose session");
    },
  ]);

  const demoResponse = await fetchWithTimeout(`${baseUrl}/api/demo-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ username: "demo", password: "demo" }),
  });

  assert(
    demoResponse.status === 200,
    `demo login should succeed (got ${demoResponse.status})`,
  );

  const setCookie = demoResponse.headers.get("set-cookie") ?? "";
  const projectsResponse = await fetchWithTimeout(`${baseUrl}/projects`, {
    headers: {
      cookie: setCookie,
    },
  });
  const projectsBody = await projectsResponse.text();

  assert(
    projectsResponse.status === 200,
    `demo session /projects should render (got ${projectsResponse.status})`,
  );
  assert(
    projectsBody.includes("Live Login Required"),
    "demo session should show live-login-required message",
  );

  return results;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

  assert(url, "NEXT_PUBLIC_SUPABASE_URL is missing from .env.local");
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local");

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const failures = [];
  const passes = [];

  function pass(message) {
    passes.push(message);
    console.log(`PASS: ${message}`);
  }

  function fail(message) {
    failures.push(message);
    console.error(`FAIL: ${message}`);
  }

  async function runTest(name, fn) {
    try {
      await fn();
      pass(name);
    } catch (error) {
      fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let createdProjectId = null;
  let createdTaskIds = [];
  let testUserId = null;
  let originalProjectAccess = null;

  try {
    await runTest("portal_users.can_access_projects column exists", async () => {
      const { data, error } = await admin
        .from("portal_users")
        .select("id,email,is_admin,can_access_projects")
        .limit(1);

      assert(!error, error?.message ?? "portal_users query failed");
      assert(Array.isArray(data), "portal_users should return rows");
      assert(
        data[0] && "can_access_projects" in data[0],
        "can_access_projects column is missing",
      );
    });

    await runTest("projects and project_tasks tables exist", async () => {
      const [{ error: projectError }, { error: taskError }] = await Promise.all([
        admin.from("projects").select("id").limit(1),
        admin.from("project_tasks").select("id").limit(1),
      ]);

      assert(!projectError, projectError?.message ?? "projects table missing");
      assert(!taskError, taskError?.message ?? "project_tasks table missing");
    });

    await runTest("admin user can be used as project owner", async () => {
      const { data, error } = await admin
        .from("portal_users")
        .select("id,email,is_admin,can_access_projects")
        .eq("is_admin", true)
        .limit(1)
        .maybeSingle();

      assert(!error, error?.message ?? "admin lookup failed");
      assert(data?.id, "no admin portal user found for test ownership");
      testUserId = data.id;
      originalProjectAccess = data.can_access_projects;
    });

    await runTest("project CRUD lifecycle", async () => {
      assert(testUserId, "missing test user id");

      const { data: project, error: createError } = await admin
        .from("projects")
        .insert({
          name: `PM Test Project ${Date.now()}`,
          description: "Automated project management verification",
          status: "active",
          start_date: daysAgo(7),
          target_end_date: daysFromNow(30),
          created_by: testUserId,
        })
        .select("id,name,status")
        .single();

      assert(!createError, createError?.message ?? "project insert failed");
      assert(project?.id, "project id missing after insert");
      createdProjectId = project.id;

      const { error: updateError } = await admin
        .from("projects")
        .update({ description: "Updated by automated test" })
        .eq("id", createdProjectId);

      assert(!updateError, updateError?.message ?? "project update failed");

      const { data: fetchedProject, error: fetchError } = await admin
        .from("projects")
        .select("id,description")
        .eq("id", createdProjectId)
        .single();

      assert(!fetchError, fetchError?.message ?? "project fetch failed");
      assert(
        fetchedProject?.description === "Updated by automated test",
        "project description did not persist",
      );
    });

    await runTest("task CRUD and dashboard stats", async () => {
      assert(createdProjectId, "missing created project id");

      const taskPayloads = [
        {
          project_id: createdProjectId,
          title: "Completed setup task",
          status: "completed",
          priority: "medium",
          start_date: daysAgo(5),
          due_date: daysAgo(1),
          completed_at: new Date().toISOString(),
          sort_order: 0,
          created_by: testUserId,
        },
        {
          project_id: createdProjectId,
          title: "Outstanding future task",
          status: "in_progress",
          priority: "high",
          start_date: daysAgo(1),
          due_date: daysFromNow(7),
          sort_order: 1,
          created_by: testUserId,
        },
        {
          project_id: createdProjectId,
          title: "Overdue open task",
          status: "todo",
          priority: "urgent",
          start_date: daysAgo(10),
          due_date: daysAgo(2),
          sort_order: 2,
          created_by: testUserId,
        },
      ];

      const { data: insertedTasks, error: insertError } = await admin
        .from("project_tasks")
        .insert(taskPayloads)
        .select("id,status,due_date");

      assert(!insertError, insertError?.message ?? "task insert failed");
      assert(insertedTasks?.length === 3, "expected 3 inserted tasks");
      createdTaskIds = insertedTasks.map((task) => task.id);

      const stats = calculateStats(insertedTasks);
      assert(stats.totalTasks === 3, `expected 3 total tasks, got ${stats.totalTasks}`);
      assert(
        stats.completedTasks === 1,
        `expected 1 completed task, got ${stats.completedTasks}`,
      );
      assert(
        stats.outstandingTasks === 2,
        `expected 2 outstanding tasks, got ${stats.outstandingTasks}`,
      );
      assert(
        stats.overdueTasks === 1,
        `expected 1 overdue task, got ${stats.overdueTasks}`,
      );
      assert(
        stats.completionPercent === 33,
        `expected 33% completion, got ${stats.completionPercent}`,
      );

      const overdueTaskId = insertedTasks.find((task) => task.status === "todo")?.id;
      assert(overdueTaskId, "missing overdue task id");

      const { error: completeError } = await admin
        .from("project_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", overdueTaskId);

      assert(!completeError, completeError?.message ?? "task completion failed");

      const { data: refreshedTasks, error: refreshError } = await admin
        .from("project_tasks")
        .select("id,status,due_date")
        .eq("project_id", createdProjectId);

      assert(!refreshError, refreshError?.message ?? "task refresh failed");

      const refreshedStats = calculateStats(refreshedTasks ?? []);
      assert(
        refreshedStats.completedTasks === 2,
        `expected 2 completed tasks after update, got ${refreshedStats.completedTasks}`,
      );
      assert(
        refreshedStats.overdueTasks === 0,
        `expected 0 overdue tasks after completion, got ${refreshedStats.overdueTasks}`,
      );
      assert(
        refreshedStats.completionPercent === 67,
        `expected 67% completion after update, got ${refreshedStats.completionPercent}`,
      );
    });

    await runTest("can_access_projects flag can be toggled for non-admin users", async () => {
      const { data: nonAdmin, error } = await admin
        .from("portal_users")
        .select("id,email,can_access_projects")
        .eq("is_admin", false)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!nonAdmin) {
        console.log("SKIP: no non-admin portal user available for access-flag test");
        return;
      }

      const nextValue = !nonAdmin.can_access_projects;
      const { error: updateError } = await admin
        .from("portal_users")
        .update({ can_access_projects: nextValue })
        .eq("id", nonAdmin.id);

      assert(!updateError, updateError?.message ?? "access flag update failed");

      const { data: restoredCheck, error: readError } = await admin
        .from("portal_users")
        .select("can_access_projects")
        .eq("id", nonAdmin.id)
        .single();

      assert(!readError, readError?.message ?? "access flag read failed");
      assert(
        restoredCheck?.can_access_projects === nextValue,
        "can_access_projects did not persist",
      );

      const { error: restoreError } = await admin
        .from("portal_users")
        .update({ can_access_projects: nonAdmin.can_access_projects })
        .eq("id", nonAdmin.id);

      assert(!restoreError, restoreError?.message ?? "access flag restore failed");
    });

    await runTest("HTTP route protections and demo-mode behavior", async () => {
      const routes = await testHttpRoutes(baseUrl);
      assert(routes.length >= 2, "expected HTTP route checks");
    });

    if (process.env.SKIP_BUILD !== "1") {
      await runTest("production build succeeds", async () => {
        const { execSync } = await import("node:child_process");
        execSync("npm run build", {
          cwd: root,
          stdio: "pipe",
          env: { ...process.env, ...env },
        });
      });
    } else {
      console.log("SKIP: production build (SKIP_BUILD=1)");
    }
  } finally {
    if (createdTaskIds.length > 0) {
      await admin.from("project_tasks").delete().in("id", createdTaskIds);
    }

    if (createdProjectId) {
      await admin.from("projects").delete().eq("id", createdProjectId);
    }
  }

  console.log("\n--- Test Summary ---");
  console.log(`Passed: ${passes.length}`);
  console.log(`Failed: ${failures.length}`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("\nAll project management tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});