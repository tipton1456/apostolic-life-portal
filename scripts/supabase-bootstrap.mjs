import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile, applyEnv } from "./load-env.mjs";

applyEnv(loadEnvFile());

const root = resolve(import.meta.dirname, "..");
const migrationsDir = resolve(root, "supabase/migrations");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const projectRef = JSON.parse(
  Buffer.from(anonKey.split(".")[1], "base64url").toString("utf8"),
).ref;

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

async function sleep(ms) {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function isOnline() {
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function restoreProject() {
  if (!accessToken) {
    console.log("No SUPABASE_ACCESS_TOKEN set — skip API restore.");
    return false;
  }

  console.log(`Requesting restore for project ${projectRef}...`);

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/restore`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const body = await response.text();

  if (!response.ok) {
    console.log(`Restore API response (${response.status}): ${body.slice(0, 300)}`);
    return false;
  }

  console.log("Restore request accepted.");
  return true;
}

async function waitForOnline(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await isOnline()) {
      console.log(`Project is online (attempt ${attempt}).`);
      return true;
    }

    console.log(`Waiting for project to come online... (${attempt}/${maxAttempts})`);
    await sleep(10000);
  }

  return false;
}

async function runSqlViaManagementApi(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`SQL query failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return body;
}

async function runSqlViaPsql(sql) {
  const { spawnSync } = await import("node:child_process");
  const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  const result = spawnSync(
    "psql",
    [connectionString, "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "psql failed");
  }
}

async function tableExists(tableName) {
  const sql = `select to_regclass('public.${tableName}') is not null as exists;`;

  if (accessToken) {
    const raw = await runSqlViaManagementApi(sql);
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.[0]?.exists);
  }

  if (dbPassword) {
    const { spawnSync } = await import("node:child_process");
    const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
    const result = spawnSync("psql", [connectionString, "-tAc", sql], { encoding: "utf8" });

    if (result.status !== 0) {
      throw new Error(result.stderr || "psql table check failed");
    }

    return result.stdout.trim() === "t";
  }

  return null;
}

async function applyMigrations() {
  if (!accessToken && !dbPassword) {
    console.log("");
    console.log("Cannot apply migrations automatically without one of:");
    console.log("  - SUPABASE_ACCESS_TOKEN (Management API)");
    console.log("  - SUPABASE_DB_PASSWORD (direct psql via pooler)");
    console.log("");
    console.log("Apply migrations manually in Supabase SQL Editor, or set one of the above and rerun:");
    console.log("  npm run db:bootstrap");
    return false;
  }

  const runner = accessToken ? runSqlViaManagementApi : runSqlViaPsql;
  let applied = 0;

  for (const fileName of migrationFiles) {
    const markerTable = "__portal_migrations";
    const checkSql = `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = '${markerTable}') as exists;`;

    let hasMarkerTable = false;

    if (accessToken) {
      const raw = await runSqlViaManagementApi(checkSql);
      hasMarkerTable = Boolean(JSON.parse(raw)?.[0]?.exists);
    } else {
      const { spawnSync } = await import("node:child_process");
      const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
      const result = spawnSync("psql", [connectionString, "-tAc", checkSql], { encoding: "utf8" });
      hasMarkerTable = result.stdout.trim() === "t";
    }

    if (!hasMarkerTable) {
      await runner(`
        create table if not exists public.__portal_migrations (
          id text primary key,
          applied_at timestamptz not null default now()
        );
      `);
    }

    const alreadyAppliedSql = `select exists (select 1 from public.__portal_migrations where id = '${fileName}') as exists;`;
    let alreadyApplied = false;

    if (accessToken) {
      const raw = await runSqlViaManagementApi(alreadyAppliedSql);
      alreadyApplied = Boolean(JSON.parse(raw)?.[0]?.exists);
    } else {
      const { spawnSync } = await import("node:child_process");
      const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
      const result = spawnSync("psql", [connectionString, "-tAc", alreadyAppliedSql], {
        encoding: "utf8",
      });
      alreadyApplied = result.stdout.trim() === "t";
    }

    if (alreadyApplied) {
      console.log(`[skip] ${fileName}`);
      continue;
    }

    const sql = readFileSync(resolve(migrationsDir, fileName), "utf8");
    console.log(`[apply] ${fileName}`);
    await runner(sql);
    await runner(
      `insert into public.__portal_migrations (id) values ('${fileName}') on conflict (id) do nothing;`,
    );
    applied += 1;
  }

  console.log(`Applied ${applied} migration(s).`);
  return true;
}

async function verifySchema() {
  const requiredTables = [
    "portal_users",
    "projects",
    "project_tasks",
    "communication_logs",
    "expense_reimbursement_requests",
  ];

  console.log("");
  console.log("Schema verification:");

  for (const table of requiredTables) {
    const exists = await tableExists(table);

    if (exists === null) {
      console.log(`  [?] ${table} (cannot verify without DB credentials)`);
      continue;
    }

    console.log(`  [${exists ? "ok" : "missing"}] ${table}`);
  }
}

console.log("=== Supabase bootstrap ===");
console.log(`Project ref: ${projectRef}`);

if (!(await isOnline())) {
  await restoreProject();
}

if (!(await waitForOnline())) {
  console.error("");
  console.error("Project is still offline.");
  console.error("Resume it in the Supabase dashboard:");
  console.error(`  https://supabase.com/dashboard/project/${projectRef}`);
  process.exit(1);
}

await applyMigrations();
await verifySchema();

console.log("");
console.log("Bootstrap complete. Run `npm run db:health` to confirm connectivity.");