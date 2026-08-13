import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { applyEnv, loadEnvFile } from "./load-env.mjs";

applyEnv(loadEnvFile());

const scrypt = promisify(scryptCallback);
const email = (process.env.VAN_PLAN_ADMIN_EMAIL || "s.tipton@apostoliclifeupci.com")
  .trim()
  .toLowerCase();
const password = process.env.VAN_PLAN_ADMIN_PASSWORD || "";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!password) {
  console.error("Set VAN_PLAN_ADMIN_PASSWORD before running this script.");
  process.exit(1);
}

if (!url || !key) {
  console.error("Missing Supabase admin configuration.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const derived = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt}$${derived.toString("hex")}`;

const response = await fetch(
  `${url}/rest/v1/van_plan_users?email=eq.${encodeURIComponent(email)}`,
  {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      password_hash: passwordHash,
      must_reset_password: false,
    }),
  },
);

const body = await response.text();

if (!response.ok) {
  console.error(`Password update failed (${response.status}): ${body.slice(0, 400)}`);
  process.exit(1);
}

const rows = JSON.parse(body);
console.log(`Updated ${rows.length} auction user(s) for ${email}.`);
