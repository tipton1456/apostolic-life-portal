import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvFile(envPath = resolve(import.meta.dirname, "..", ".env.local")) {
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

export function applyEnv(env) {
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}