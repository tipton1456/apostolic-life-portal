import { loadEnvFile, applyEnv } from "./load-env.mjs";

applyEnv(loadEnvFile());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const projectRef = (() => {
  try {
    const payload = JSON.parse(
      Buffer.from(anonKey.split(".")[1], "base64url").toString("utf8"),
    );
    return payload.ref ?? null;
  } catch {
    return null;
  }
})();

async function probe(label, fetchUrl, headers) {
  try {
    const response = await fetch(fetchUrl, { headers, signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    return {
      label,
      ok: response.ok,
      status: response.status,
      snippet: body.slice(0, 200),
    };
  } catch (error) {
    return {
      label,
      ok: false,
      status: 0,
      snippet: error instanceof Error ? error.message : String(error),
    };
  }
}

const checks = await Promise.all([
  probe("auth health", `${url}/auth/v1/health`, { apikey: anonKey }),
  probe(
    "rest portal_users",
    `${url}/rest/v1/portal_users?select=id&limit=1`,
    { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  ),
  serviceRoleKey
    ? probe(
        "admin portal_users",
        `${url}/rest/v1/portal_users?select=id&limit=1`,
        { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      )
    : Promise.resolve({
        label: "admin portal_users",
        ok: false,
        status: 0,
        snippet: "SUPABASE_SERVICE_ROLE_KEY not configured",
      }),
]);

console.log(`Supabase project: ${projectRef ?? "unknown"}`);
console.log(`URL: ${url}`);
console.log("");

let healthy = true;

for (const check of checks) {
  const status = check.ok ? "OK" : "FAIL";
  console.log(`[${status}] ${check.label} (${check.status || "network"})`);

  if (!check.ok) {
    healthy = false;
    console.log(`       ${check.snippet}`);
  }
}

process.exit(healthy ? 0 : 1);